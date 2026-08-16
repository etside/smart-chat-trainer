import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';

export const Route = createFileRoute('/api/public/meta/deletion')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const source = 'meta';
        const event_type = 'data_deletion';
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => { headers[key] = value; });

        try {
          const formData = await request.formData();
          const signedRequest = formData.get('signed_request') as string;


          if (!signedRequest) {
            return new Response('Missing signed_request', { status: 400 });
          }

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

          // Log the incoming request
          await supabaseAdmin.from('webhook_logs').insert({
            source,
            event_type,
            payload: { signed_request: signedRequest ? 'present' : 'missing' },
            headers,
            status_code: signedRequest ? 200 : 400
          });

          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('meta_app_secret')
            .eq('id', 1)
            .maybeSingle();

          const secret = settings?.meta_app_secret;
          if (!secret) {
            console.error('Meta App Secret not configured');
            await supabaseAdmin.from('webhook_logs').insert({ source, event_type, payload: { error: 'Secret not configured' }, status_code: 500 });
            return new Response('Server configuration error', { status: 500 });
          }

          const parts = signedRequest.split('.');
          if (parts.length !== 2) {
            await supabaseAdmin.from('webhook_logs').insert({ source, event_type, payload: { error: 'Invalid format' }, status_code: 400 });
            return new Response('Invalid signed_request format', { status: 400 });
          }
          const [encodedSig, payload] = parts as [string, string];
          
          // Decode data
          const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
          const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

          // Confirm signature
          const hmac = createHmac('sha256', secret);
          hmac.update(payload);
          const expectedSig = hmac.digest();

          if (!timingSafeEqual(sig, expectedSig)) {
            console.error('Bad Signed JSON signature!');
            await supabaseAdmin.from('webhook_logs').insert({ source, event_type, payload: { error: 'Invalid signature' }, status_code: 400 });
            return new Response('Invalid signature', { status: 400 });
          }

          const userId = data.user_id;
          console.log(`Data deletion request received for Meta User ID: ${userId}`);

          // Confirmation
          const confirmationCode = `del_${Math.random().toString(36).substring(7)}`;
          const statusUrl = `${new URL(request.url).origin}/data-deletion?id=${confirmationCode}`;

          await supabaseAdmin.from('webhook_logs').insert({ 
            source, 
            event_type, 
            payload: { user_id: userId, confirmation_code: confirmationCode }, 
            status_code: 200 
          });

          return new Response(JSON.stringify({
            url: statusUrl,
            confirmation_code: confirmationCode
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          console.error('Error handling Meta deletion request:', error);
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          await supabaseAdmin.from('webhook_logs').insert({ 
            source: 'meta', 
            event_type: 'error', 
            payload: { error: error.message }, 
            status_code: 500 
          });
          return new Response('Internal Server Error', { status: 500 });
        }

      }
    }
  }
});
