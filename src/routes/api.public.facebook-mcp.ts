import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/facebook-mcp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { tool, arguments: args } = body;

          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('meta_access_token, meta_page_id')
            .eq('id', 1)
            .maybeSingle();

          if (!settings?.meta_access_token) {
            return new Response(JSON.stringify({ error: 'Meta access token not configured' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const token = settings.meta_access_token;
          const pageId = settings.meta_page_id;

          switch (tool) {
            case 'fb_get_page_feed': {
              const limit = args?.limit || 10;
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/feed?fields=message,created_time,permalink_url,shares&limit=${limit}&access_token=${token}`
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'fb_get_page_insights': {
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/insights?metric=page_impressions,page_reach,page_engaged_users,page_fan_count&period=day&access_token=${token}`
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'fb_get_comments': {
              if (!args?.post_id) return Response.json({ error: 'post_id required' }, { status: 400 });
              const limit = args?.limit || 25;
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${args.post_id}/comments?fields=from,message,created_time,like_count&limit=${limit}&access_token=${token}`
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'fb_create_post': {
              if (!args?.message) return Response.json({ error: 'message required' }, { status: 400 });
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/feed?access_token=${token}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: args.message }),
                }
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'fb_reply_comment': {
              if (!args?.comment_id || !args?.message) {
                return Response.json({ error: 'comment_id and message required' }, { status: 400 });
              }
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${args.comment_id}/comments?access_token=${token}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: args.message }),
                }
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'fb_delete_post': {
              if (!args?.post_id) return Response.json({ error: 'post_id required' }, { status: 400 });
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${args.post_id}?access_token=${token}`,
                { method: 'DELETE' }
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'fb_get_conversations': {
              const limit = args?.limit || 5;
              const fields = `participants,updated_time,messages.limit(${limit}){message,from,created_time}`;
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=${encodeURIComponent(fields)}&access_token=${token}`
              );
              const data = await res.json();
              return Response.json({ ok: true, data });
            }

            case 'fb_send_message': {
              if (!args?.recipient_id || !args?.message) {
                return Response.json({ error: 'recipient_id and message required' }, { status: 400 });
              }
              const res = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/messages?access_token=${token}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    recipient: { id: args.recipient_id },
                    message: { text: args.message },
                  }),
                }
              );
              const data = await res.json();
              return Response.json({ ok: !data.error, data });
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
            { name: 'fb_get_page_feed', description: 'Get page posts/feed' },
            { name: 'fb_get_page_insights', description: 'Get page analytics' },
            { name: 'fb_get_comments', description: 'Get comments on a post', params: ['post_id'] },
            { name: 'fb_create_post', description: 'Create a new post', params: ['message'] },
            { name: 'fb_reply_comment', description: 'Reply to a comment', params: ['comment_id', 'message'] },
            { name: 'fb_delete_post', description: 'Delete a post', params: ['post_id'] },
            { name: 'fb_get_conversations', description: 'Get Messenger conversations' },
            { name: 'fb_send_message', description: 'Send a Messenger message', params: ['recipient_id', 'message'] },
          ],
        });
      },
    },
  },
});
