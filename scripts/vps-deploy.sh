#!/bin/bash
# Daddy AI - VPS Deploy Script (for updates)
# Run on VPS: bash scripts/vps-deploy.sh
set -e

echo "=== Daddy AI Deploy ==="
echo "Starting at $(date)"

cd /var/www/daddyai

# Pull latest code
echo "[1/5] Pulling latest code..."
git pull origin main

# Install dependencies
echo "[2/5] Installing dependencies..."
export BUN_INSTALL=/root/.bun
export PATH=$BUN_INSTALL/bin:$PATH
bun install

# Ensure swap
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
fi

# Build
echo "[3/5] Building..."
NITRO_PRESET=node-server bun run build

# Restart PM2
echo "[4/5] Restarting app..."
pm2 delete daddyai 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# Reload Nginx
echo "[5/5] Reloading Nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "=== Deploy Complete ==="
pm2 status
echo "Finished at $(date)"
