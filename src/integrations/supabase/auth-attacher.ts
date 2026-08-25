import { createMiddleware } from '@tanstack/react-start'

const AUTH_TOKEN_KEY = 'daddyai_auth_token';

// Client-side middleware that attaches the auth token to server function requests
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    let token: string | null = null;

    // Read token from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      token = localStorage.getItem(AUTH_TOKEN_KEY);
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
