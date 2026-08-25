// Server-side Supabase-compatible client using direct PostgreSQL
// Replaces @supabase/supabase-js for server operations
// Bypasses RLS — use for admin/trusted server-side operations only
import { createClient, type SupabaseCompat } from './pg-client';
import { pgAuthClient } from './pg-auth';

const serverAuth = {
  async getUser(token: string) {
    return pgAuthClient.getUser(token);
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    return pgAuthClient.signInWithPassword({ email, password });
  },
  async signUp({ email, password }: { email: string; password: string }) {
    return pgAuthClient.signUp({ email, password });
  },
  async signOut(token: string) {
    return pgAuthClient.signOut(token);
  },
  admin: {
    async createUser(email: string, password: string, metadata?: Record<string, unknown>) {
      return pgAuthClient.admin.createUser({ email, password, data: metadata });
    },
  },
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
};

const db = createClient();

const supabaseAdminClient: SupabaseCompat & { auth: typeof serverAuth } = {
  from: db.from.bind(db),
  rpc: db.rpc.bind(db),
  auth: serverAuth,
};

let _admin: typeof supabaseAdminClient | undefined;

export const supabaseAdmin = new Proxy({} as typeof supabaseAdminClient, {
  get(_, prop, receiver) {
    if (!_admin) _admin = supabaseAdminClient;
    return Reflect.get(_admin, prop, receiver);
  },
});
