# Daddy AI Deployment Guide

## Overview

This guide explains how to deploy Daddy AI to your VPS (104.248.152.70) with the domain `daddyai.online`.

## Required GitHub Secrets

Add these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### VPS Connection
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `VPS_HOST` | VPS IP address | `159.223.77.185` |
| `VPS_USER` | SSH username | `root` |
| `VPS_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### Supabase Configuration
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | `sb_publishable_xxxx` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID | `xxxx` |

### Netlify (Optional - for backup deployment)
| Secret Name | Description |
|-------------|-------------|
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token |
| `NETLIFY_SITE_ID` | Netlify site ID |

## Initial VPS Setup

1. **SSH into your VPS:**
   ```bash
   ssh root@159.223.77.185
   ```

2. **Run the setup script:**
   ```bash
   curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/smart-chat-trainer/main/scripts/setup-vps.sh | bash
   ```

3. **Update the Nginx configuration:**
   - Edit `/etc/nginx/sites-available/daddyai`
   - Update SSL certificate paths after Certbot runs

4. **Configure SSL:**
   ```bash
   sudo certbot --nginx -d daddyai.online -d www.daddyai.online
   ```

## GitHub Actions Workflow

The workflow is configured in `.github/workflows/deploy.yml` and will:

1. **Build & Typecheck** - Runs on every push/PR
2. **Deploy to VPS** - Deploys to your VPS on main branch pushes
3. **Deploy to Netlify** - Keeps Netlify backup alive

### Workflow Triggers
- Push to `main` branch
- Pull requests to `main`
- Manual trigger via GitHub Actions

## Environment Variables

### Production (.env)
```bash
SUPABASE_PROJECT_ID="lcpxaoahyxdyhnkxafvf"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_Y7vlHI2hQSMcKIdpUvT98Q_3KwZtNif"
SUPABASE_URL="https://lcpxaoahyxdyhnkxafvf.supabase.co"
VITE_SUPABASE_PROJECT_ID="lcpxaoahyxdyhnkxafvf"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_Y7vlHI2hQSMcKIdpUvT98Q_3KwZtNif"
VITE_SUPABASE_URL="https://lcpxaoahyxdyhnkxafvf.supabase.co"

# Domain Configuration
SITE_URL="https://daddyai.online"
VITE_SITE_URL="https://daddyai.online"
APP_NAME="Daddy AI"
APP_DOMAIN="daddyai.online"

# Wear Impressive API Sync
SYNC_TOKEN=f5e1f9b68be9fc8d69867283a6ebdf61755f23e93ff0c014def36f555d7fb42f
SYNC_SECRET=c05d89defdc77a396b6543c85bce957bb5a12394a0828c54825817d51b3cd58a
```

## Supabase Configuration

Update these in your Supabase dashboard:

1. **Authentication → URL Configuration:**
   - Site URL: `https://daddyai.online`
   - Redirect URLs: Add `https://daddyai.online/**`

2. **API → Settings:**
   - Project URL: `https://lcpxaoahyxdyhnkxafvf.supabase.co`

## Domain Configuration

Your domain `daddyai.online` is already pointed to `159.223.77.185`.

### DNS Records (already configured)
- Type: A
- Name: @
- Value: 159.223.77.185

- Type: A
- Name: www
- Value: 159.223.77.185

## Troubleshooting

### Check application status
```bash
ssh root@159.223.77.185
pm2 status
pm2 logs daddyai
```

### Restart application
```bash
pm2 restart daddyai
```

### Check Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues
```bash
sudo certbot renew --dry-run
sudo systemctl restart certbot.timer
```

## Files Created

- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `ecosystem.config.js` - PM2 configuration
- `nginx.daddyai.conf` - Nginx configuration
- `scripts/setup-vps.sh` - VPS setup script
- `DEPLOYMENT.md` - This deployment guide
