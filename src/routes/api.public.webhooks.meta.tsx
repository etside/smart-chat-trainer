import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { generateReply } from '@/lib/agent.server'
import { sendMetaMessage } from '@/lib/meta-sender.server'
import { verifyWebhookSignature } from '@/lib/admin.server'

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
            .eq('id', 1)
            .maybeSingle()

          if (token === settings?.meta_webhook_verify_token) {
            return new Response(challenge)
          }
        }
        return new Response('Forbidden', { status: 403 })
      },
      POST: async ({ request }) => {
        try {
          // Verify webhook signature for security
          const rawBody = await request.text()
          const signature = request.headers.get('x-hub-signature-256')

          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('meta_app_secret')
            .eq('id', 1)
            .maybeSingle()

          if (settings?.meta_app_secret) {
            const isValid = await verifyWebhookSignature(rawBody, signature, settings.meta_app_secret)
            if (!isValid) {
              console.warn('Meta webhook signature verification failed')
              return new Response('Forbidden', { status: 403 })
            }
          }

          const body = JSON.parse(rawBody) as any
          
          // Log incoming webhook for visibility
          await supabaseAdmin.from('webhook_logs').insert({
            event_type: body.object || 'meta_webhook',
            payload: body,
            source: 'meta'
          })

          // Handle Messenger/WhatsApp/Instagram messages
          if (body.object === 'page' || body.object === 'whatsapp_business_account' || body.object === 'instagram') {
            const entry = body.entry?.[0]
            const changes = entry?.changes?.[0]?.value || entry?.messaging?.[0]

            if (changes) {
              const senderId = changes.sender?.id || changes.from
              const messageText = changes.message?.text || changes.messages?.[0]?.text?.body

              // Detect platform from field type
              const fieldType = entry?.changes?.[0]?.field
              let platform = 'messenger'
              if (body.object === 'whatsapp_business_account') platform = 'whatsapp'
              else if (fieldType === 'messages' && changes.message?.is_echo === undefined) {
                // Instagram DMs come through page webhook with instagram field
                if (changes.from && /^\d+$/.test(changes.from) && senderId !== changes.from) {
                  platform = 'instagram'
                }
              }
              
              if (senderId && messageText) {
                // Generate AI reply using RAG
                const { reply } = await generateReply(messageText, [])
                
                // Send real reply back to Meta
                try {
                  await sendMetaMessage(senderId, reply, platform as any);
                } catch (sendError) {
                  console.error('Failed to send Meta message:', sendError);
                }
                
                // Log it to conversations
                const { data: conv } = await supabaseAdmin.from('conversations').insert({
                  external_id: senderId,
                  source: platform
                }).select('id').single()

                if (conv) {
                  await supabaseAdmin.from('messages').insert([
                    { conversation_id: conv.id, role: 'user', content: messageText, seq: 0 },
                    { conversation_id: conv.id, role: 'assistant', content: reply, seq: 1 }
                  ])
                }
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
