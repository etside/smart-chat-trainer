#!/bin/bash
# Daddy AI - VPS Setup Script
# Run on fresh Ubuntu 22.04 droplet: bash scripts/vps-setup.sh
set -e

echo "=== Daddy AI VPS Setup ==="
echo "Starting at $(date)"

# --- System Updates ---
echo "[1/10] Updating system..."
apt-get update -qq
apt-get upgrade -y -qq

# --- Install Dependencies ---
echo "[2/10] Installing dependencies..."
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw

# --- Install Node.js 22 ---
echo "[3/10] Installing Node.js 22..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "Node: $(node --version)"

# --- Install Bun ---
echo "[4/10] Installing Bun..."
if [ ! -f /root/.bun/bin/bun ]; then
  curl -fsSL https://bun.sh/install | bash
fi
export BUN_INSTALL=/root/.bun
export PATH=$BUN_INSTALL/bin:$PATH
echo "Bun: $(bun --version)"

# --- Install PM2 ---
echo "[5/10] Installing PM2..."
npm install -g pm2 2>/dev/null
echo "PM2: $(pm2 --version)"

# --- Setup Swap (for 1GB droplets) ---
echo "[6/10] Setting up swap..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
  echo "2GB swap created"
else
  echo "Swap already exists"
fi

# --- Clone Project ---
echo "[7/10] Cloning project..."
mkdir -p /var/www/daddyai
cd /var/www/daddyai
if [ ! -d .git ]; then
  git clone https://github.com/etside/smart-chat-trainer.git .
else
  git pull origin main
fi

# --- Install & Build ---
echo "[8/10] Installing dependencies and building..."
export BUN_INSTALL=/root/.bun
export PATH=$BUN_INSTALL/bin:$PATH
bun install
NITRO_PRESET=node-server bun run build

# --- Configure PM2 ---
echo "[9/10] Configuring PM2..."
pm2 delete daddyai 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# --- Configure Nginx ---
echo "[10/10] Configuring Nginx..."
cp /var/www/daddyai/nginx.daddyai.conf /etc/nginx/sites-available/daddyai
ln -sf /etc/nginx/sites-available/daddyai /etc/nginx/sites-enabled/daddyai
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# --- Setup SSL (if DNS is ready) ---
echo ""
echo "=== Checking DNS ==="
if host daddyai.online > /dev/null 2>&1; then
  echo "DNS is ready. Setting up SSL..."
  certbot --nginx -d daddyai.online -d www.daddyai.online \
    --non-interactive --agree-tos --email neuronit.info@gmail.com
  echo "SSL configured!"
else
  echo "DNS not ready yet. Run this later:"
  echo "  certbot --nginx -d daddyai.online -d www.daddyai.online --non-interactive --agree-tos --email neuronit.info@gmail.com"
fi

# --- Final Status ---
echo ""
echo "=== Setup Complete ==="
echo "App: http://localhost:3000"
echo "Nginx: http://daddyai.online (once DNS propagates)"
pm2 status
echo ""
echo "Useful commands:"
echo "  pm2 logs daddyai        # View logs"
echo "  pm2 restart daddyai     # Restart app"
echo "  pm2 status              # Check status"
echo "  nginx -t                # Test nginx config"
echo "  systemctl restart nginx # Restart nginx"
echo ""
echo "Setup finished at $(date)"
