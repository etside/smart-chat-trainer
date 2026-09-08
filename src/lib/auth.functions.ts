import { createServerFn } from '@tanstack/react-start';
import { pgAuthClient } from '@/integrations/supabase/pg-auth';

import { z } from 'zod';

export const serverSignIn = createServerFn({ method: 'POST' })
  .inputValidator((data) => z.object({ email: z.string(), password: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return pgAuthClient.signInWithPassword(data);
  });

export const serverSignUp = createServerFn({ method: 'POST' })
  .inputValidator((data) => z.object({ email: z.string(), password: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return pgAuthClient.signUp(data);
  });

export const serverSignOut = createServerFn({ method: 'POST' })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return pgAuthClient.signOut(data.token);
  });

export const serverGetUser = createServerFn({ method: 'GET' })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return pgAuthClient.getUser(data.token);
  });

export const serverGetSession = createServerFn({ method: 'GET' })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const result = await pgAuthClient.getUser(data.token);
    if (result.error || !result.data.user) {
      return { data: { session: null }, error: result.error };
    }
    return {
      data: {
        session: {
          user: result.data.user,
          access_token: data.token,
          refresh_token: '',
        },
      },
      error: null,
    };
  });
