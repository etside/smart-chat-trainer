#!/usr/bin/env node
// Daddy AI - Create admin user (Node.js version for reliable bcrypt)
// Usage: node scripts/create-admin.mjs [email] [password]
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  host: process.env['PGHOST'] || 'localhost',
  port: parseInt(process.env['PGPORT'] || '5432'),
  database: process.env['PGDATABASE'] || 'daddyai',
  user: process.env['PGUSER'] || 'daddyai',
  password: process.env['PGPASSWORD'] || 'daddyai_2026_secure',
});

const email = process.argv[2] || 'aniktonmoybd@gmail.com';
const password = process.argv[3] || 'DaddyAI2026!';

async function main() {
  console.log(`Creating admin user: ${email}`);

  const hashedPassword = await bcrypt.hash(password, 12);

  // Insert user
  const userResult = await pool.query(
    `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, NOW(), NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET encrypted_password = $2, updated_at = NOW()
     RETURNING id, email`,
    [email, hashedPassword]
  );

  const user = userResult.rows[0];
  console.log(`User created/found: ${user.email} (${user.id})`);

  // Assign admin role
  await pool.query(
    `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')
     ON CONFLICT DO NOTHING`,
    [user.id]
  );

  console.log('Admin role assigned.');
  console.log(`\nLogin at: https://daddyai.online/auth`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
