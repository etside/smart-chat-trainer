import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/meta-mcp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { tool, arguments: args } = body;

          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('meta_access_token, meta_app_id, meta_app_secret, meta_page_id')
            .eq('id', 1)
            .maybeSingle();

          const appId = settings?.meta_app_id;
          const appSecret = settings?.meta_app_secret;
          const pageId = settings?.meta_page_id;
          const token = settings?.meta_access_token;

          switch (tool) {
            case 'meta_debug_token': {
              if (!token) return Response.json({ error: 'No token configured' }, { status: 400 });
              const appToken = `${appId}|${appSecret}`;
              const res = await fetch(
                `https://graph.facebook.com/v19.0/debug_token?input_token=${token}&access_token=${appToken}`
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'meta_exchange_token': {
              if (!token) return Response.json({ error: 'No token to exchange' }, { status: 400 });
              const res = await fetch(
                `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`
              );
              const data = await res.json();
              if (data.access_token) {
                await supabaseAdmin
                  .from('agent_settings')
                  .update({ meta_access_token: data.access_token })
                  .eq('id', 1);
                return Response.json({ ok: true, data: { ...data, access_token: data.access_token.slice(0, 20) + '...' } });
              }
              return Response.json({ ok: false, data });
            }

            case 'meta_refresh_token': {
              if (!token) return Response.json({ error: 'No token to refresh' }, { status: 400 });
              const res = await fetch(
                `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`
              );
              const data = await res.json();
              if (data.access_token) {
                await supabaseAdmin
                  .from('agent_settings')
                  .update({ meta_access_token: data.access_token })
                  .eq('id', 1);
                return Response.json({ ok: true, data: { ...data, access_token: data.access_token.slice(0, 20) + '...' } });
              }
              return Response.json({ ok: false, data });
            }

            case 'meta_get_page_token': {
              if (!token) return Response.json({ error: 'No user token' }, { status: 400 });
              const res = await fetch(
                `https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`
              );
              const data = await res.json();
              if (data.data?.length > 0) {
                const page = data.data.find((p: any) => p.id === pageId) || data.data[0];
                await supabaseAdmin
                  .from('agent_settings')
                  .update({ meta_access_token: page.access_token })
                  .eq('id', 1);
                return Response.json({ ok: true, data: { page_id: page.id, page_name: page.name, token_prefix: page.access_token.slice(0, 20) + '...' } });
              }
              return Response.json({ ok: false, data });
            }

            case 'meta_subscribe_webhook': {
              if (!token) return Response.json({ error: 'No token' }, { status: 400 });
              const appToken = `${appId}|${appSecret}`;
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    subscribed_fields: 'messages,messaging_postbacks,messaging_optins',
                    access_token: token,
                  }),
                }
              );
              const data = await res.json();
              return Response.json({ ok: data.success === true, data });
            }

            case 'meta_get_app_info': {
              const appToken = `${appId}|${appSecret}`;
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${appId}?fields=name,id,link&access_token=${appToken}`
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'meta_update_token': {
              if (!args?.token) return Response.json({ error: 'token required' }, { status: 400 });
              await supabaseAdmin
                .from('agent_settings')
                .update({ meta_access_token: args.token })
                .eq('id', 1);
              return Response.json({ ok: true, message: 'Token updated' });
            }

            default:
              return Response.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
          }
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      },

      GET: async () => {
        return Response.json({
          tools: [
            { name: 'meta_debug_token', description: 'Inspect token validity, expiration, and scopes' },
            { name: 'meta_exchange_token', description: 'Exchange short-lived token for long-lived token (~60 days)' },
            { name: 'meta_refresh_token', description: 'Refresh a long-lived token before expiration' },
            { name: 'meta_get_page_token', description: 'Get Page Access Token from user token' },
            { name: 'meta_subscribe_webhook', description: 'Subscribe webhook to page messages' },
            { name: 'meta_get_app_info', description: 'Get Meta App information' },
            { name: 'meta_update_token', description: 'Update the stored access token', params: ['token'] },
          ],
        });
      },
    },
  },
});
