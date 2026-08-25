/**
 * Self-hosted Supabase replacement: JWT-based auth system backed by PostgreSQL.
 *
 * Provides a Supabase-compatible auth API:
 *
 *   const { data, error } = await supabase.auth.signInWithPassword({ email, password })
 *   const { data, error } = await supabase.auth.signUp({ email, password })
 *   const { data, error } = await supabase.auth.getUser(token)
 *   const { error }   = await supabase.auth.signOut()
 *   const { data }    = await supabase.auth.getSession()
 *
 * Required environment variable:  JWT_SECRET
 *
 * Expected database schema:
 *   CREATE SCHEMA IF NOT EXISTS auth;
 *
 *   CREATE TABLE auth.users (
 *     id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     email             TEXT UNIQUE NOT NULL,
 *     encrypted_password TEXT NOT NULL,
 *     email_confirmed_at TIMESTAMPTZ,
 *     created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     raw_app_meta_data  JSONB NOT NULL DEFAULT '{}',
 *     raw_user_meta_data JSONB NOT NULL DEFAULT '{}',
 *     last_sign_in_at   TIMESTAMPTZ
 *   );
 *
 *   CREATE TABLE auth.sessions (
 *     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *     token      TEXT NOT NULL UNIQUE,
 *     expires_at TIMESTAMPTZ NOT NULL
 *   );
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from './pg-client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Authentication will not work.');
}
const JWT_EXPIRES_IN = '7d';
const SESSION_DAYS = 7;

// ---------------------------------------------------------------------------
// Types — modelled after Supabase auth types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  raw_app_meta_data: Record<string, unknown>;
  raw_user_meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  role: string | undefined;
}

export interface AuthSession {
  id: string;
  user_id: string;
  /** The JWT access token — sent in `Authorization: Bearer <token>` */
  access_token: string;
  /** Alias for access_token (backward compat with Supabase client) */
  token: string;
  /** Opaque refresh token (same as the session UUID) */
  refresh_token: string;
  expires_at: string;
}

export interface AuthError {
  message: string;
  code: string;
}

export interface AuthResult {
  data: { user: AuthUser | null; session: AuthSession | null };
  error: AuthError | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signJwt(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, role: 'authenticated' }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyJwt(token: string): { sub: string; email: string; role?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; role?: string };
  } catch {
    return null;
  }
}

function rowToUser(row: Record<string, unknown>): AuthUser {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    raw_app_meta_data: (row['raw_app_meta_data'] as Record<string, unknown>) ?? {},
    raw_user_meta_data: (row['raw_user_meta_data'] as Record<string, unknown>) ?? {},
    created_at: String(row['created_at']),
    updated_at: String(row['updated_at']),
    email_confirmed_at: row['email_confirmed_at'] ? String(row['email_confirmed_at']) : null,
    last_sign_in_at: row['last_sign_in_at'] ? String(row['last_sign_in_at']) : null,
    role: row['role'] as string | undefined,
  };
}

function buildSession(
  sessionId: string,
  userId: string,
  accessToken: string,
  expiresAt: Date,
): AuthSession {
  return {
    id: sessionId,
    user_id: userId,
    access_token: accessToken,
    token: accessToken,
    refresh_token: sessionId,
    expires_at: expiresAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Core auth functions
// ---------------------------------------------------------------------------

/**
 * Verify a token (session UUID or JWT) and return the associated user.
 *
 * Matches Supabase shape:  `{ data: { user }, error }`
 */
export async function getUser(
  token: string,
): Promise<{ data: { user: AuthUser | null }; error: AuthError | null }> {
  if (!token) {
    return {
      data: { user: null },
      error: { message: 'No token provided', code: 'AUTH_MISSING_TOKEN' },
    };
  }

  try {
    // 1. Try as a session token (UUID stored in auth.sessions)
    const sessResult = await pool.query(
      `SELECT s.id AS session_id, s.user_id, s.expires_at,
              u.id, u.email, u.raw_app_meta_data, u.raw_user_meta_data,
              u.created_at, u.updated_at, u.email_confirmed_at, u.last_sign_in_at
       FROM auth.sessions s
       JOIN auth.users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token],
    );

    if (sessResult.rows.length > 0) {
      const r = sessResult.rows[0]!;
      return { data: { user: rowToUser(r) }, error: null };
    }

    // 2. Try as a JWT
    const payload = verifyJwt(token);
    if (!payload) {
      return {
        data: { user: null },
        error: { message: 'Invalid or expired token', code: 'AUTH_INVALID_TOKEN' },
      };
    }

    const userResult = await pool.query('SELECT * FROM auth.users WHERE id = $1', [payload.sub]);
    if (userResult.rows.length === 0) {
      return {
        data: { user: null },
        error: { message: 'User not found', code: 'AUTH_USER_NOT_FOUND' },
      };
    }

    return { data: { user: rowToUser(userResult.rows[0]!) }, error: null };
  } catch (err) {
    return {
      data: { user: null },
      error: { message: (err as Error).message, code: 'AUTH_ERROR' },
    };
  }
}

/**
 * Authenticate with email + password.  On success returns { user, session }.
 */
export async function signInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const result = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', code: 'AUTH_INVALID_CREDENTIALS' },
      };
    }

    const row = result.rows[0]!;
    const valid = await bcrypt.compare(password, row['encrypted_password'] as string);
    if (!valid) {
      return {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', code: 'AUTH_INVALID_CREDENTIALS' },
      };
    }

    // Update last_sign_in_at
    await pool.query(
      'UPDATE auth.users SET last_sign_in_at = NOW(), updated_at = NOW() WHERE id = $1',
      [row['id']],
    );

    // Create session
    const accessToken = signJwt(row['id'] as string, row['email'] as string);
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO auth.sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, row['id'], accessToken, expiresAt.toISOString()],
    );

    const user = rowToUser(row);
    const session = buildSession(sessionId, row['id'] as string, accessToken, expiresAt);

    return { data: { user, session }, error: null };
  } catch (err) {
    return {
      data: { user: null, session: null },
      error: { message: (err as Error).message, code: 'AUTH_ERROR' },
    };
  }
}

/**
 * Register a new user.  Returns { user, session } (auto-signed-in).
 */
export async function signUp({
  email,
  password,
  data: metadata,
}: {
  email: string;
  password: string;
  data?: Record<string, unknown>;
}): Promise<AuthResult> {
  try {
    // Check for existing user
    const existing = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return {
        data: { user: null, session: null },
        error: { message: 'User already registered', code: 'AUTH_USER_EXISTS' },
      };
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO auth.users
         (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, email, hashedPassword, now, now, now, '{}', JSON.stringify(metadata ?? {})],
    );

    // Auto-assign admin role for the owner email
    if (email.toLowerCase() === 'aniktonmoybd@gmail.com') {
      await pool.query(
        "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING",
        [id],
      );
    }

    // Build session
    const accessToken = signJwt(id, email);
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO auth.sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, id, accessToken, expiresAt.toISOString()],
    );

    const userResult = await pool.query('SELECT * FROM auth.users WHERE id = $1', [id]);
    const user = userResult.rows[0] ? rowToUser(userResult.rows[0]) : {
      id,
      email,
      raw_app_meta_data: {},
      raw_user_meta_data: metadata ?? {},
      created_at: now,
      updated_at: now,
      email_confirmed_at: now,
      last_sign_in_at: null,
      role: undefined,
    } satisfies AuthUser;

    const session = buildSession(sessionId, id, accessToken, expiresAt);

    return { data: { user, session }, error: null };
  } catch (err) {
    return {
      data: { user: null, session: null },
      error: { message: (err as Error).message, code: 'AUTH_ERROR' },
    };
  }
}

/**
 * Sign out: invalidate the session.
 *
 * Accepts either the access_token (JWT) or the refresh_token (session UUID).
 */
export async function signOut(
  token: string,
): Promise<{ error: AuthError | null }> {
  try {
    // Try deleting by session token (the access_token stored in auth.sessions.token)
    const res = await pool.query('DELETE FROM auth.sessions WHERE token = $1', [token]);
    // If no rows deleted, it might be a refresh_token (session UUID) — try that too
    if (res.rowCount === 0) {
      await pool.query('DELETE FROM auth.sessions WHERE id = $1', [token]);
    }
    return { error: null };
  } catch (err) {
    return { error: { message: (err as Error).message, code: 'AUTH_ERROR' } };
  }
}

/**
 * Get current session from the server-side in-memory store.
 *
 * For server-side use only; the in-memory store is populated by middleware
 * that extracts the Bearer token from the incoming request.
 */
export async function getSession(): Promise<{
  data: { session: AuthSession | null };
  error: null;
}> {
  // The in-memory store is for convenience in server-side code.
  // In practice the token comes from the Authorization header and
  // is validated via getUser().  This returns null as a safe default.
  return { data: { session: null }, error: null };
}

/**
 * Listen for auth state changes.  No-op on the server.
 */
export function onAuthStateChange(
  _callback: (event: string, session: AuthSession | null) => void,
): { data: { subscription: { unsubscribe: () => void } } } {
  return {
    data: {
      subscription: {
        unsubscribe: () => {},
      },
    },
  };
}

/**
 * Update a user's password (and optionally email / metadata).
 *
 * Accepts a JWT access_token to identify the user.
 */
export async function updateUser(
  token: string,
  updates: { password?: string; email?: string; data?: Record<string, unknown> },
): Promise<AuthResult> {
  try {
    // Resolve user from token
    const { data: userData, error: authError } = await getUser(token);
    if (authError || !userData.user) {
      return { data: { user: null, session: null }, error: authError ?? { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' } };
    }
    const userId = userData.user.id;

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.password) {
      setClauses.push(`encrypted_password = $${idx++}`);
      params.push(await bcrypt.hash(updates.password, 12));
    }
    if (updates.email) {
      setClauses.push(`email = $${idx++}`);
      params.push(updates.email);
    }
    if (updates.data) {
      setClauses.push(`raw_user_meta_data = raw_user_meta_data || $${idx}::jsonb`);
      params.push(JSON.stringify(updates.data));
      idx++;
    }

    params.push(userId);
    const result = await pool.query(
      `UPDATE auth.users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      return {
        data: { user: null, session: null },
        error: { message: 'User not found', code: 'AUTH_USER_NOT_FOUND' },
      };
    }

    return { data: { user: rowToUser(result.rows[0]!), session: null }, error: null };
  } catch (err) {
    return {
      data: { user: null, session: null },
      error: { message: (err as Error).message, code: 'AUTH_ERROR' },
    };
  }
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

/**
 * Admin: create a user without requiring an existing session.
 */
export async function adminCreateUser({
  email,
  password,
  data: metadata,
  email_confirm = true,
}: {
  email: string;
  password: string;
  data?: Record<string, unknown>;
  email_confirm?: boolean;
}): Promise<AuthResult> {
  try {
    const existing = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return {
        data: { user: null, session: null },
        error: { message: 'User already registered', code: 'AUTH_USER_EXISTS' },
      };
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const confirmedAt = email_confirm ? now : null;

    await pool.query(
      `INSERT INTO auth.users
         (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, email, hashedPassword, confirmedAt, now, now, '{}', JSON.stringify(metadata ?? {})],
    );

    const userResult = await pool.query('SELECT * FROM auth.users WHERE id = $1', [id]);
    const user = userResult.rows[0] ? rowToUser(userResult.rows[0]) : {
      id,
      email,
      raw_app_meta_data: {},
      raw_user_meta_data: metadata ?? {},
      created_at: now,
      updated_at: now,
      email_confirmed_at: confirmedAt,
      last_sign_in_at: null,
      role: undefined,
    } satisfies AuthUser;

    // Optionally create a session so the admin can immediately use the token
    const accessToken = signJwt(id, email);
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO auth.sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, id, accessToken, expiresAt.toISOString()],
    );

    const session = buildSession(sessionId, id, accessToken, expiresAt);

    return { data: { user, session }, error: null };
  } catch (err) {
    return {
      data: { user: null, session: null },
      error: { message: (err as Error).message, code: 'AUTH_ERROR' },
    };
  }
}

// ---------------------------------------------------------------------------
// Combined auth client — drop-in for `supabase.auth`
// ---------------------------------------------------------------------------

export const pgAuth = {
  getUser,
  signInWithPassword,
  signUp,
  signOut,
  getSession,
  onAuthStateChange,
  updateUser,
  admin: {
    createUser: adminCreateUser,
  },
};

/** Alias used by existing imports in client.ts / client.server.ts / auth-middleware.ts */
export const pgAuthClient = pgAuth;
