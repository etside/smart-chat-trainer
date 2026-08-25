// Self-hosted Supabase-compatible client using direct PostgreSQL
// Drop-in replacement for @supabase/supabase-js
import { createClient, type SupabaseCompat } from './pg-client';
import { pgAuthClient, type AuthUser, type AuthSession } from './pg-auth';

// ─── localStorage auth adapter (client-side only) ───

const AUTH_TOKEN_KEY = 'daddyai_auth_token';

function getClientStorage() {
  if (typeof window === 'undefined') return null;
  return localStorage;
}

// ─── Session management ───

let _currentSession: { user: AuthUser; session: AuthSession } | null = null;
let _authListeners: Array<(event: string, session: { user: AuthUser; session: AuthSession } | null) => void> = [];

function notifyAuthListeners(event: string, session: { user: AuthUser; session: AuthSession } | null) {
  for (const listener of _authListeners) {
    try { listener(event, session); } catch {}
  }
}

// ─── Auth API ───

const auth = {
  async getSession(): Promise<{ data: { session: { user: AuthUser; session: AuthSession } | null }; error: null }> {
    if (_currentSession) {
      return { data: { session: _currentSession }, error: null };
    }

    const storage = getClientStorage();
    if (storage) {
      const token = storage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        const { data } = await pgAuthClient.getUser(token);
        if (data.user) {
          _currentSession = {
            user: data.user,
            session: { id: '', user_id: data.user.id, token, access_token: token, refresh_token: '', expires_at: '' },
          };
          return { data: { session: _currentSession }, error: null };
        }
        storage.removeItem(AUTH_TOKEN_KEY);
      }
    }

    return { data: { session: null }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const result = await pgAuthClient.signInWithPassword({ email, password });
    if (result.error) return { data: { user: null, session: null }, error: result.error };

    _currentSession = result.data as { user: AuthUser; session: AuthSession };

    const storage = getClientStorage();
    if (storage && result.data.session) {
      storage.setItem(AUTH_TOKEN_KEY, result.data.session.token);
    }

    notifyAuthListeners('SIGNED_IN', _currentSession);
    return { data: result.data, error: null };
  },

  async signUp({ email, password }: { email: string; password: string }) {
    const result = await pgAuthClient.signUp({ email, password });
    if (result.error) return { data: { user: null, session: null }, error: result.error };

    _currentSession = result.data as { user: AuthUser; session: AuthSession };

    const storage = getClientStorage();
    if (storage && result.data.session) {
      storage.setItem(AUTH_TOKEN_KEY, result.data.session.token);
    }

    notifyAuthListeners('SIGNED_IN', _currentSession);
    return { data: result.data, error: null };
  },

  async signOut() {
    const storage = getClientStorage();
    const token = storage?.getItem(AUTH_TOKEN_KEY);
    if (token) {
      await pgAuthClient.signOut(token);
      storage.removeItem(AUTH_TOKEN_KEY);
    }
    _currentSession = null;
    notifyAuthListeners('SIGNED_OUT', null);
    return { error: null };
  },

  async getUser(token: string) {
    return pgAuthClient.getUser(token);
  },

  async updateUser(updates: { password?: string; data?: Record<string, unknown> }) {
    if (!_currentSession) {
      return { data: { user: null }, error: { message: 'Not authenticated', code: 'AUTH_NO_SESSION' } };
    }
    return pgAuthClient.updateUser(_currentSession.session.access_token, updates);
  },

  onAuthStateChange(callback: (event: string, session: { user: AuthUser; session: AuthSession } | null) => void) {
    _authListeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            _authListeners = _authListeners.filter(l => l !== callback);
          },
        },
      },
    };
  },

  admin: {
    async createUser(email: string, password: string, metadata?: Record<string, unknown>) {
      return pgAuthClient.admin.createUser({ email, password, data: metadata });
    },
  },
};

// ─── Main client ───

const db = createClient();

const supabaseClient: SupabaseCompat & { auth: typeof auth } = {
  from: db.from.bind(db),
  rpc: db.rpc.bind(db),
  auth,
};

let _client: typeof supabaseClient | undefined;

export const supabase = new Proxy({} as typeof supabaseClient, {
  get(_, prop, receiver) {
    if (!_client) _client = supabaseClient;
    return Reflect.get(_client, prop, receiver);
  },
});
