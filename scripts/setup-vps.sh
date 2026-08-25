#!/bin/bash
# Daddy AI - VPS Setup Script
# Run this on the VPS to set up the deployment environment

set -e

echo "🚀 Setting up Daddy AI on VPS..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Create deployment directory
sudo mkdir -p /var/www/daddyai
sudo chown -R $USER:$USER /var/www/daddyai

# Clone the repository
cd /var/www/daddyai
git clone https://github.com/YOUR_USERNAME/smart-chat-trainer.git .

# Install dependencies
bun install

# Build the project
NITRO_PRESET=node-server bun run build

# Setup PM2 to start on boot
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

# Start the application
pm2 start ecosystem.config.js

# Setup Nginx
sudo cp nginx.daddyai.conf /etc/nginx/sites-available/daddyai
sudo ln -sf /etc/nginx/sites-available/daddyai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Certbot
sudo certbot --nginx -d daddyai.online -d www.daddyai.online --non-interactive --agree-tos -m your-email@example.com

# Setup auto-renewal
sudo systemctl status certbot.timer
sudo certbot renew --dry-run

echo "✅ Setup complete! Daddy AI should be running at https://daddyai.online"
