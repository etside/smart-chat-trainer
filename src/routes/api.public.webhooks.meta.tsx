import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { generateReply } from '@/lib/agent.server'
import { sendMetaMessage } from '@/lib/meta-sender.server'
import { verifyWebhookSignature } from '@/lib/admin.server'

// Parse structured JSON response from AI
function parseStructuredReply(reply: string): { type: 'structured' | 'plain', data?: any, text?: string } {
  try {
    const parsed = JSON.parse(reply)
    if (parsed.messages && Array.isArray(parsed.messages)) {
      return { type: 'structured', data: parsed }
    }
  } catch {}
  return { type: 'plain', text: reply }
}

// Send structured rich messages via Meta API
async function sendStructuredMessage(senderId: string, data: any, platform: string, accessToken: string, pageId?: string) {
  for (const msg of data.messages) {
    if (msg.type === 'text') {
      await sendMetaMessage(senderId, msg.text, platform as any)
    } else if (msg.type === 'product_card' && msg.product_card) {
      const card = msg.product_card
      // Send as generic template (image + title + subtitle + button)
      const templatePayload: any = {
        recipient: { id: senderId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: [{
                title: card.title,
                subtitle: `${card.currency || 'BDT'} ${card.price}\n${card.availability}${card.features ? '\n' + card.features.slice(0, 3).join(' | ') : ''}`,
                image_url: card.image_url,
                buttons: card.actions?.map((a: any) => ({
                  type: 'web_url',
                  url: a.url,
                  title: a.label || 'Order Now'
                })) || []
              }]
            }
          }
        }
      }

      const apiUrl = platform === 'whatsapp'
        ? `https://graph.facebook.com/v19.0/${senderId}/messages`
        : `https://graph.facebook.com/v19.0/me/messages`

      await fetch(`${apiUrl}?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      })
    } else if (msg.type === 'handoff' && msg.handoff) {
      await sendMetaMessage(senderId, msg.handoff.message, platform as any)
      // Log handoff for admin attention
      await supabaseAdmin.from('webhook_logs').insert({
        event_type: 'handoff',
        payload: { senderId, reason: msg.handoff.reason, summary: msg.handoff.summary_for_human_agent },
        source: platform
      })
    } else if (msg.type === 'order_confirmation' && msg.order_confirmation) {
      const oc = msg.order_confirmation
      const text = `${oc.headline}\n${oc.details.join('\n')}${oc.next_step ? '\n' + oc.next_step : ''}`
      await sendMetaMessage(senderId, text, platform as any)
    }
  }
}

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
          const rawBody = await request.text()
          const signature = request.headers.get('x-hub-signature-256')

          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('meta_app_secret, meta_access_token, meta_page_id')
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

          await supabaseAdmin.from('webhook_logs').insert({
            event_type: body.object || 'meta_webhook',
            payload: body,
            source: 'meta'
          })

          if (body.object === 'page' || body.object === 'whatsapp_business_account' || body.object === 'instagram') {
            const entry = body.entry?.[0]
            const changes = entry?.changes?.[0]?.value || entry?.messaging?.[0]

            if (changes) {
              const senderId = changes.sender?.id || changes.from
              const messageText = changes.message?.text || changes.messages?.[0]?.text?.body

              const fieldType = entry?.changes?.[0]?.field
              let platform = 'messenger'
              if (body.object === 'whatsapp_business_account') platform = 'whatsapp'
              else if (fieldType === 'messages' && changes.message?.is_echo === undefined) {
                if (changes.from && /^\d+$/.test(changes.from) && senderId !== changes.from) {
                  platform = 'instagram'
                }
              }

              if (senderId && messageText) {
                const { reply } = await generateReply(messageText, [])

                // Parse structured or plain reply
                const parsed = parseStructuredReply(reply)

                try {
                  if (parsed.type === 'structured' && settings?.meta_access_token) {
                    await sendStructuredMessage(senderId, parsed.data, platform, settings.meta_access_token, settings.meta_page_id)
                  } else {
                    await sendMetaMessage(senderId, reply, platform as any)
                  }
                } catch (sendError) {
                  console.error('Failed to send Meta message:', sendError)
                }

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
