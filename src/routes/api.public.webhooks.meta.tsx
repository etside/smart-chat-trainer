import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/webhooks/meta')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: settings } = await supabaseAdmin
          .from('agent_settings')
          .select('meta_webhook_verify_token')
          .eq('id', 1)
          .maybeSingle()

        const verifyToken = settings?.meta_webhook_verify_token || 'daddy_ai_meta_verify_token'

        if (mode === 'subscribe' && token === verifyToken) {
          console.log('Meta Webhook Verified')
          return new Response(challenge)
        }
        
        return new Response('Forbidden', { status: 403 })
      },
      POST: async ({ request }) => {
        const body = await request.json()
        
        // Log incoming message for training/debugging
        console.log('Incoming Meta Webhook:', JSON.stringify(body, null, 2))
        
        // TODO: Map Meta conversation API payload to training data or AI response trigger
        // This is where we would call Daddy AI to reply to WhatsApp/Messenger
        
        return new Response('OK')
      }
    }
  }
})
