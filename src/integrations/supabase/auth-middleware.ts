import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { pgAuthClient } from './pg-auth'
import { createClient } from './pg-client'

function createRequestClient() {
  const db = createClient();
  return {
    from: db.from.bind(db),
    rpc: db.rpc.bind(db),
    auth: {
      getUser: (token: string) => pgAuthClient.getUser(token),
      getSession: async () => ({ data: { session: null } }),
    },
  };
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Only Bearer tokens are supported');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    const { data, error } = await pgAuthClient.getUser(token);

    if (error || !data.user) {
      console.error('[Auth] getUser failed:', error?.message);
      throw new Error('Unauthorized: Invalid token');
    }

    const supabase = createRequestClient();

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: data.user,
      },
    });
  },
);
