import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';

export const Route = createFileRoute('/api/public/meta/deletion')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const formData = await request.formData();
          const signedRequest = formData.get('signed_request') as string;

          if (!signedRequest) {
            return new Response('Missing signed_request', { status: 400 });
          }

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('meta_app_secret')
            .eq('id', 1)
            .maybeSingle();

          const secret = settings?.meta_app_secret;
          if (!secret) {
            console.error('Meta App Secret not configured');
            return new Response('Server configuration error', { status: 500 });
          }

          const [encodedSig, payload] = signedRequest.split('.');
          
          // Decode data
          const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
          const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

          // Confirm signature
          const hmac = createHmac('sha256', secret);
          hmac.update(payload);
          const expectedSig = hmac.digest();

          if (!timingSafeEqual(sig, expectedSig)) {
            console.error('Bad Signed JSON signature!');
            return new Response('Invalid signature', { status: 400 });
          }

          const userId = data.user_id;
          console.log(`Data deletion request received for Meta User ID: ${userId}`);

          // In a real app, we would queue a background job to delete user data
          // For now, we return a confirmation
          const confirmationCode = `del_${Math.random().toString(36).substring(7)}`;
          const statusUrl = `${new URL(request.url).origin}/data-deletion?id=${confirmationCode}`;

          return new Response(JSON.stringify({
            url: statusUrl,
            confirmation_code: confirmationCode
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Error handling Meta deletion request:', error);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
    }
  }
});
