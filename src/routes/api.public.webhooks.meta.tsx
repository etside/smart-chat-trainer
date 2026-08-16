import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { generateReply } from '@/lib/agent.server'

export const Route = createFileRoute('/api/public/webhooks/meta')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')

        if (mode === 'subscribe') {
          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('meta_webhook_verify_token')
            .single()

          if (token === settings?.meta_webhook_verify_token) {
            return new Response(challenge)
          }
        }
        return new Response('Forbidden', { status: 403 })
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          
          // Log incoming webhook for visibility
          await supabaseAdmin.from('webhook_logs').insert({
            event_type: body.object || 'meta_webhook',
            payload: body,
            status: 'received'
          })

          // Handle Messenger/WhatsApp messages
          if (body.object === 'page' || body.object === 'whatsapp_business_account') {
            const entry = body.entry?.[0]
            const changes = entry?.changes?.[0]?.value || entry?.messaging?.[0]
            
            if (changes) {
              const senderId = changes.sender?.id || changes.from
              const messageText = changes.message?.text || changes.messages?.[0]?.text?.body
              
              if (senderId && messageText) {
                // Generate AI reply using RAG
                const reply = await generateReply(messageText, { sessionId: senderId })
                
                // Here you would call Meta API to send message back
                // For now we log it to conversations
                await supabaseAdmin.from('conversations').insert({
                  external_id: senderId,
                  message: messageText,
                  reply: reply,
                  platform: body.object === 'page' ? 'messenger' : 'whatsapp'
                })
              }
            }
          }

          return new Response('EVENT_RECEIVED')
        } catch (error) {
          console.error('Meta webhook error:', error)
          return new Response('Error', { status: 500 })
        }
      }
    }
  }
})
