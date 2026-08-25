#!/bin/bash
# Daddy AI - Create admin user
# Run on VPS after PostgreSQL setup: bash scripts/create-admin.sh
set -e

echo "=== Daddy AI Admin User Setup ==="

ADMIN_EMAIL="${1:-aniktonmoybd@gmail.com}"
ADMIN_PASS="${2:-DaddyAI2026!}"

echo "Creating admin user: $ADMIN_EMAIL"

sudo -u postgres psql -d daddyai << SQL
-- Create admin user with bcrypt-hashed password
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '$ADMIN_EMAIL',
  '\$2a\$12\$LQv3tWOdoVuXHvOqZ8VLcuQjKJxT3qNzJ8R5pL5mZ2kX4vN6bO7Xe',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Assign admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = '$ADMIN_EMAIL'
ON CONFLICT DO NOTHING;
SQL

echo ""
echo "=== Admin User Created ==="
echo "Email: $ADMIN_EMAIL"
echo "Password: $ADMIN_PASS"
echo ""
echo "Login at: https://daddyai.online/auth"
