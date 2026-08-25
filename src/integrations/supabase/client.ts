// Self-hosted Supabase-compatible client for BROWSER
// Uses TanStack Start server functions to talk to PostgreSQL — no direct DB in browser
import type { AuthUser, AuthSession } from './pg-auth';

const AUTH_TOKEN_KEY = 'daddyai_auth_token';

function getClientStorage() {
  if (typeof window === 'undefined') return null;
  return localStorage;
}

// ─── Lazy-loaded server functions ───

let _fns: typeof import('@/lib/auth.functions') | null = null;

async function loadFns() {
  if (!_fns) _fns = await import('@/lib/auth.functions');
  return _fns;
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
        try {
          const fns = await loadFns();
          const result: any = await fns.serverGetSession({ data: { token } });
          if (result.data?.session) {
            _currentSession = result.data.session as { user: AuthUser; session: AuthSession };
            return { data: { session: _currentSession }, error: null };
          }
        } catch {}
        storage.removeItem(AUTH_TOKEN_KEY);
      }
    }

    return { data: { session: null }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const fns = await loadFns();
      const result: any = await fns.serverSignIn({ data: { email, password } });
      if (result.error) return { data: { user: null, session: null }, error: result.error };

      _currentSession = result.data as { user: AuthUser; session: AuthSession };

      const storage = getClientStorage();
      if (storage && result.data.session) {
        storage.setItem(AUTH_TOKEN_KEY, result.data.session.access_token ?? result.data.session.token ?? '');
      }

      notifyAuthListeners('SIGNED_IN', _currentSession);
      return { data: result.data, error: null };
    } catch (err) {
      return { data: { user: null, session: null }, error: { message: (err as Error).message, code: 'AUTH_ERROR' } };
    }
  },

  async signUp({ email, password }: { email: string; password: string }) {
    try {
      const fns = await loadFns();
      const result: any = await fns.serverSignUp({ data: { email, password } });
      if (result.error) return { data: { user: null, session: null }, error: result.error };

      _currentSession = result.data as { user: AuthUser; session: AuthSession };

      const storage = getClientStorage();
      if (storage && result.data.session) {
        storage.setItem(AUTH_TOKEN_KEY, result.data.session.access_token ?? result.data.session.token ?? '');
      }

      notifyAuthListeners('SIGNED_IN', _currentSession);
      return { data: result.data, error: null };
    } catch (err) {
      return { data: { user: null, session: null }, error: { message: (err as Error).message, code: 'AUTH_ERROR' } };
    }
  },

  async signOut() {
    const storage = getClientStorage();
    const token = storage?.getItem(AUTH_TOKEN_KEY);
    if (token) {
      try {
        const fns = await loadFns();
        await fns.serverSignOut({ data: { token } });
      } catch {}
      storage.removeItem(AUTH_TOKEN_KEY);
    }
    _currentSession = null;
    notifyAuthListeners('SIGNED_OUT', null);
    return { error: null };
  },

  async getUser(token: string) {
    if (typeof window !== 'undefined') {
      // Browser: use cached session
      return { data: { user: _currentSession?.user ?? null }, error: null };
    }
    // Server: direct call
    const { pgAuthClient } = await import('./pg-auth');
    return pgAuthClient.getUser(token);
  },

  async updateUser(updates: { password?: string; data?: Record<string, unknown> }) {
    if (!_currentSession) {
      return { data: { user: null }, error: { message: 'Not authenticated', code: 'AUTH_NO_SESSION' } };
    }
    const { pgAuthClient } = await import('./pg-auth');
    return pgAuthClient.updateUser(
      _currentSession.session.access_token ?? _currentSession.session.token ?? '',
      updates,
    );
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
      const { pgAuthClient } = await import('./pg-auth');
      return pgAuthClient.admin.createUser({ email, password, data: metadata });
    },
  },
};

// ─── Main client ───

function throwClientQueryError(): never {
  throw new Error(
    '[DaddyAI] Direct DB queries are not available in the browser. Use createServerFn() instead.',
  );
}

export interface SupabaseCompat {
  from: (table: string) => never;
  rpc: (name: string, params?: Record<string, unknown>) => Promise<never>;
  auth: typeof auth;
}

const supabaseClient: SupabaseCompat = {
  from: throwClientQueryError,
  rpc: throwClientQueryError,
  auth,
};

let _client: typeof supabaseClient | undefined;

export const supabase = new Proxy({} as typeof supabaseClient, {
  get(_, prop, receiver) {
    if (!_client) _client = supabaseClient;
    return Reflect.get(_client, prop, receiver);
  },
});
