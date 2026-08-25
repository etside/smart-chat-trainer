#!/bin/bash
# Daddy AI - Setup PostgreSQL on VPS
# Run on VPS after vps-setup.sh: bash scripts/vps-setup-pg.sh
set -e

echo "=== Daddy AI PostgreSQL Setup ==="

# Install PostgreSQL
echo "[1/5] Installing PostgreSQL..."
apt-get install -y -qq postgresql postgresql-contrib

# Start and enable
echo "[2/5] Starting PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Create database and user
echo "[3/5] Creating database and user..."
sudo -u postgres psql -c "CREATE USER daddyai WITH PASSWORD 'daddyai_2026_secure';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE daddyai OWNER daddyai;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE daddyai TO daddyai;" 2>/dev/null || true

# Install extensions (pg_trgm and vector)
echo "[4/5] Installing extensions..."
sudo -u postgres psql -d daddyai -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>/dev/null || true
sudo -u postgres psql -d daddyai -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

# Apply schema
echo "[5/5] Applying schema..."
sudo -u postgres psql -d daddyai -f /var/www/daddyai/scripts/schema.sql 2>&1 | tail -20

echo ""
echo "=== PostgreSQL Setup Complete ==="
echo "Database: daddyai"
echo "User: daddyai"
echo "Password: daddyai_2026_secure"
echo "Connection: postgresql://daddyai:daddyai_2026_secure@localhost:5432/daddyai"
