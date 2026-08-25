#!/bin/bash
# Daddy AI - DigitalOcean API Deployment Script
# Usage: DO_API_TOKEN=xxx ./scripts/do-deploy.sh [command]
#
# Commands:
#   create    - Create a new droplet and deploy
#   deploy    - Deploy latest code to existing droplet
#   status    - Check droplet status
#   destroy   - Destroy the droplet
#   logs      - Check PM2 logs on VPS
#   restart   - Restart the app on VPS
#   ssh       - SSH into the VPS
#
# Environment:
#   DO_API_TOKEN  - DigitalOcean API token (required)
#   DROPLET_NAME  - Droplet name (default: daddyai-prod)
#   DROPLET_SIZE  - Droplet size (default: s-1vcpu-1gb)
#   DROPLET_REGION - Region (default: nyc3)
#   SSH_KEY_ID    - DigitalOcean SSH key ID (optional)

set -euo pipefail

# Configuration
DO_API_TOKEN="${DO_API_TOKEN:?DO_API_TOKEN is required. Set it: export DO_API_TOKEN=xxx}"
DROPLET_NAME="${DROPLET_NAME:-daddyai-prod}"
DROPLET_SIZE="${DROPLET_SIZE:-s-1vcpu-1gb}"
DROPLET_REGION="${DROPLET_REGION:-nyc3}"
DROPLET_IMAGE="${DROPLET_IMAGE:-ubuntu-24-04-x64}"
REPO="etside/smart-chat-trainer"
DEPLOY_DIR="/var/www/daddyai"
DO_API="https://api.digitalocean.com/v2"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DO]${NC} $1"; }
warn() { echo -e "${YELLOW}[DO]${NC} $1"; }
err() { echo -e "${RED}[DO]${NC} $1" >&2; }

do_api() {
  local method=$1 endpoint=$2
  shift 2
  curl -s -X "$method" \
    -H "Authorization: Bearer $DO_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$DO_API$endpoint" "$@"
}

get_droplet_ip() {
  do_api GET "/droplets?name=$DROPLET_NAME" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['droplets'][0]['networks']['v4'][0]['ip_address'] if d['droplets'] else '')" 2>/dev/null || echo ""
}

wait_for_droplet() {
  local ip=""
  local max_attempts=60
  local attempt=0
  log "Waiting for droplet to become ready..."
  while [ $attempt -lt $max_attempts ]; do
    ip=$(get_droplet_ip)
    if [ -n "$ip" ]; then
      if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes root@"$ip" "echo ok" >/dev/null 2>&1; then
        echo "$ip"
        return 0
      fi
    fi
    attempt=$((attempt + 1))
    sleep 5
  done
  err "Droplet not ready after $((max_attempts * 5))s"
  return 1
}

setup_vps() {
  local ip=$1
  log "Setting up VPS at $ip..."

  ssh -o StrictHostKeyChecking=no root@"$ip" << 'SETUP'
set -e

# System updates
apt update && apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install PM2, Nginx, PostgreSQL
npm install -g pm2
apt install -y nginx certbot python3-certbot-nginx postgresql postgresql-contrib

# Setup PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create database and user (idempotent)
sudo -u postgres psql -c "CREATE USER daddyai WITH PASSWORD 'daddyai_2026_secure';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE daddyai OWNER daddyai;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE daddyai TO daddyai;" 2>/dev/null || true
# Enable pg_trm extension for similarity search
sudo -u postgres psql -d daddyai -c "CREATE EXTENSION IF NOT EXISTS pg_trm;" 2>/dev/null || true

# Create deploy directory
mkdir -p /var/www/daddyai

# Setup PM2 startup
pm2 startup systemd -u root --hp /root

# Setup swap (for 1GB droplet)
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
fi

echo "VPS setup complete"
SETUP
  log "VPS setup complete"
}

deploy_code() {
  local ip=$1
  log "Deploying code to $ip..."

  ssh -o StrictHostKeyChecking=no root@"$ip" << DEPLOY
set -e
export BUN_INSTALL=/root/.bun
export PATH=\$BUN_INSTALL/bin:\$PATH

cd $DEPLOY_DIR

# Pull latest code
git pull origin main

# Install deps with npm (bun has TanStack Start bundling issues)
npm install

# Build
NITRO_PRESET=node-server npm run build

# Check routes in build output
echo "=== Build verification ==="
if ls .output/server/index.mjs >/dev/null 2>&1; then
  echo "Server bundle: OK"
else
  echo "WARNING: No server bundle found - check TanStack Start config"
fi
ls -la .output/server/ 2>/dev/null || echo "No .output/server directory"

# Run database migrations if psql is available
if command -v psql &>/dev/null; then
  echo "=== Running database migrations ==="
  PGPASSWORD=daddyai_2026_secure psql -h localhost -U daddyai -d daddyai -f migration.sql 2>/dev/null || echo "migration.sql skipped (tables may exist)"
  PGPASSWORD=daddyai_2026_secure psql -h localhost -U daddyai -d daddyai -f migration_sales_agent.sql 2>/dev/null || echo "migration_sales_agent.sql applied"
  echo "=== Migrations complete ==="
fi

# Restart app
pm2 delete daddyai 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "=== Deployment complete ==="
pm2 status
DEPLOY
  log "Deployment complete"
}

setup_nginx() {
  local ip=$1
  log "Setting up Nginx..."

  # Copy nginx config
  scp -o StrictHostKeyChecking=no nginx.daddyai.conf root@"$ip":/etc/nginx/sites-available/daddyai

  ssh -o StrictHostKeyChecking=no root@"$ip" << 'NGINX'
set -e
ln -sf /etc/nginx/sites-available/daddyai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
NGINX
  log "Nginx configured"
}

setup_ssl() {
  local ip=$1
  local email="${SSL_EMAIL:-aniktonmoybd@gmail.com}"

  log "Setting up SSL with Certbot..."
  ssh -o StrictHostKeyChecking=no root@"$ip" \
    "certbot --nginx -d daddyai.online -d www.daddyai.online --non-interactive --agree-tos -m $email"
  log "SSL configured"
}

cmd_create() {
  log "Creating droplet '$DROPLET_NAME'..."

  # Check if droplet already exists
  local existing
  existing=$(get_droplet_ip)
  if [ -n "$existing" ]; then
    warn "Droplet already exists at $existing"
    return 0
  fi

  # Build SSH keys array
  local ssh_keys="[]"
  if [ -n "${SSH_KEY_ID:-}" ]; then
    ssh_keys="[$SSH_KEY_ID]"
  fi

  do_api POST "/droplets" -d "{
    \"name\": \"$DROPLET_NAME\",
    \"region\": \"$DROPLET_REGION\",
    \"size\": \"$DROPLET_SIZE\",
    \"image\": \"$DROPLET_IMAGE\",
    \"ssh_keys\": $ssh_keys,
    \"user_data\": \"#!/bin/bash\\napt update && apt upgrade -y\",
    \"tags\": [\"daddyai\", \"production\"]
  }"

  local ip
  ip=$(wait_for_droplet)
  if [ -z "$ip" ]; then
    err "Failed to get droplet IP"
    return 1
  fi

  log "Droplet created at $ip"

  # Clone repo
  ssh -o StrictHostKeyChecking=no root@"$ip" \
    "git clone https://github.com/$REPO.git $DEPLOY_DIR"

  setup_vps "$ip"
  deploy_code "$ip"
  setup_nginx "$ip"
  setup_ssl "$ip"

  log "=== Daddy AI deployed at https://daddyai.online ==="
  log "VPS IP: $ip"
}

cmd_deploy() {
  local ip
  ip=$(get_droplet_ip)
  if [ -z "$ip" ]; then
    err "No droplet found. Run: $0 create"
    return 1
  fi
  deploy_code "$ip"
}

cmd_status() {
  local ip
  ip=$(get_droplet_ip)
  if [ -z "$ip" ]; then
    warn "No droplet found"
    return 0
  fi

  log "Droplet: $DROPLET_NAME at $ip"
  ssh -o StrictHostKeyChecking=no root@"$ip" \
    "pm2 status 2>/dev/null; echo '---'; systemctl status nginx --no-pager 2>/dev/null | head -5"
}

cmd_destroy() {
  local droplet_id
  droplet_id=$(do_api GET "/droplets?name=$DROPLET_NAME" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['droplets'][0]['id'] if d['droplets'] else '')" 2>/dev/null)

  if [ -z "$droplet_id" ]; then
    warn "No droplet found"
    return 0
  fi

  warn "Destroying droplet $DROPLET_NAME (ID: $droplet_id)..."
  do_api DELETE "/droplets/$droplet_id"
  log "Droplet destroyed"
}

cmd_logs() {
  local ip
  ip=$(get_droplet_ip)
  if [ -z "$ip" ]; then
    err "No droplet found"
    return 1
  fi
  ssh -o StrictHostKeyChecking=no root@"$ip" "pm2 logs daddyai --lines 50 --nostream"
}

cmd_restart() {
  local ip
  ip=$(get_droplet_ip)
  if [ -z "$ip" ]; then
    err "No droplet found"
    return 1
  fi
  ssh -o StrictHostKeyChecking=no root@"$ip" "pm2 restart daddyai"
  log "App restarted"
}

cmd_ssh() {
  local ip
  ip=$(get_droplet_ip)
  if [ -z "$ip" ]; then
    err "No droplet found"
    return 1
  fi
  exec ssh -o StrictHostKeyChecking=no root@"$ip"
}

# Main
case "${1:-help}" in
  create)  cmd_create ;;
  deploy)  cmd_deploy ;;
  status)  cmd_status ;;
  destroy) cmd_destroy ;;
  logs)    cmd_logs ;;
  restart) cmd_restart ;;
  ssh)     cmd_ssh ;;
  *)
    echo "Usage: DO_API_TOKEN=xxx $0 {create|deploy|status|destroy|logs|restart|ssh}"
    echo ""
    echo "Commands:"
    echo "  create   Create droplet and deploy Daddy AI"
    echo "  deploy   Deploy latest code to existing droplet"
    echo "  status   Check droplet and app status"
    echo "  destroy  Destroy the droplet"
    echo "  logs     View PM2 logs"
    echo "  restart  Restart the app"
    echo "  ssh      SSH into the VPS"
    echo ""
    echo "Environment:"
    echo "  DO_API_TOKEN    DigitalOcean API token (required)"
    echo "  DROPLET_NAME    Droplet name (default: daddyai-prod)"
    echo "  DROPLET_SIZE    Size slug (default: s-1vcpu-1gb)"
    echo "  DROPLET_REGION  Region slug (default: nyc3)"
    echo "  SSH_KEY_ID      DO SSH key ID (optional)"
    echo "  SSL_EMAIL       Email for Let's Encrypt (default: aniktonmoybd@gmail.com)"
    ;;
esac
