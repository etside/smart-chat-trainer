import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { generateReply, logConversation } from '@/lib/agent.server'
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramProductCard,
  answerTelegramCallback,
} from '@/lib/telegram-sender.server'

export const Route = createFileRoute('/api/public/webhooks/telegram')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ ok: true, service: 'daddyai-telegram-webhook' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json()

          // Get Telegram bot token from settings
          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('telegram_bot_token, auto_reply_mode')
            .eq('id', 1)
            .maybeSingle() as any

          if (!settings?.telegram_bot_token) {
            console.warn('[telegram] No telegram_bot_token configured')
            return new Response(JSON.stringify({ ok: true, skipped: 'no token' }), {
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const token = settings.telegram_bot_token
          const autoReplyMode = settings.auto_reply_mode || 'off'

          // Handle callback queries (inline button presses)
          if (body.callback_query) {
            const cb = body.callback_query
            const chatId = cb.message?.chat?.id
            const data = cb.data || ''

            await answerTelegramCallback(cb.id, token, 'Processing your order...')

            if (data.startsWith('order:')) {
              const productId = data.replace('order:', '')
              // Fetch product details
              const { data: product } = await supabaseAdmin
                .from('product_catalogue')
                .select('name, price, sizes, variants')
                .eq('id', productId)
                .maybeSingle()

              if (product) {
                const sizeText = product.sizes?.length
                  ? `\n\n📏 Available sizes: ${product.sizes.join(", ")}\n\nকোন সাইজ নিতে চান?`
                  : '\n\nকোন সাইজ নিতে চান?'
                await sendTelegramMessage(chatId, `জি 😊 ${product.name} — ৳${product.price.toLocaleString()}${sizeText}`, token)
              } else {
                await sendTelegramMessage(chatId, 'দুঃখিত, এই প্রোডাক্টটি আর পাওয়া যাচ্ছে না। অন্য কিছু দেখতে চান?', token)
              }
            }

            return new Response(JSON.stringify({ ok: true }), {
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Handle regular messages
          const message = body.message
          if (!message) {
            return new Response(JSON.stringify({ ok: true, skipped: 'no message' }), {
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const chatId = message.chat.id
          const senderId = String(chatId)
          const messageText = message.text || message.caption || ''
          const firstName = message.from?.first_name || ''
          const lastName = message.from?.last_name || ''
          const customerName = `${firstName} ${lastName}`.trim() || null

          // Handle /start command
          if (messageText === '/start') {
            await sendTelegramMessage(chatId, 'আসসালামু আলাইকুম! 😊 Wear Impressive এ আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি?', token)
            return new Response(JSON.stringify({ ok: true }), {
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Handle /help command
          if (messageText === '/help') {
            const helpText = `🛍️ *Wear Impressive AI Assistant*\n\n` +
              `আমি আপনাকে সাহায্য করতে পারি:\n` +
              `• প্রোডাক্ট খুঁজে দিতে\n` +
              `• দাম জানাতে\n` +
              `• অর্ডার নিতে\n` +
              `• সাইজ গাইড দিতে\n\n` +
              `শুধু মেসেজ করুন! 💬`
            await sendTelegramMessage(chatId, helpText, token, { parseMode: 'Markdown' })
            return new Response(JSON.stringify({ ok: true }), {
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Handle photo messages
          let attachmentMeta: Record<string, any> | null = null
          if (message.photo && message.photo.length > 0) {
            const photo = message.photo[message.photo.length - 1] // largest size
            attachmentMeta = { type: 'image', file_id: photo.file_id }
          }

          if (!messageText && !attachmentMeta) {
            return new Response(JSON.stringify({ ok: true, skipped: 'empty' }), {
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Upsert conversation session
          const { data: existingSession } = await supabaseAdmin
            .from('conversation_sessions')
            .select('id')
            .eq('external_id', senderId)
            .eq('channel', 'telegram')
            .maybeSingle()

          let sessionId: string | null = null
          if (existingSession) {
            sessionId = (existingSession as any).id
            if (customerName) {
              await supabaseAdmin
                .from('conversation_sessions')
                .update({ customer_name: customerName, last_message_at: new Date().toISOString() })
                .eq('id', sessionId)
            }
          } else {
            const { data: newSession } = await supabaseAdmin
              .from('conversation_sessions')
              .insert({ external_id: senderId, channel: 'telegram', customer_name: customerName, status: 'active' })
              .single() as any
            sessionId = newSession?.id ?? null
          }

          // Fetch conversation history for context
          let history: Array<{ role: string; content: string }> = []
          if (sessionId) {
            const { data: recentMsgs } = await supabaseAdmin
              .from('session_messages')
              .select('role, content')
              .eq('session_id', sessionId)
              .order('created_at', { ascending: true })
              .limit(30)
            if (recentMsgs) history = recentMsgs as any
          }

          // Generate AI reply
          let reply = ''
          let productCards: any[] | undefined

          try {
            const { processSalesMessage } = await import('@/lib/sales-agent.server')
            const salesResult = await processSalesMessage({
              message: messageText,
              conversationId: null,
              sessionId,
              externalId: senderId,
              channel: 'telegram',
              history,
              generateReplyFn: async (msg: string, hist: any[]) => {
                const { generateReply } = await import('@/lib/agent.server')
                return generateReply(msg, hist)
              },
            })
            reply = salesResult.reply
          } catch (aiError: any) {
            console.error('[telegram] AI reply failed:', aiError?.message)
            try {
              const { generateReply } = await import('@/lib/agent.server')
              const generated = await generateReply(messageText, history as any)
              reply = generated.reply
              productCards = generated.product_cards
            } catch (e: any) {
              console.error('[telegram] fallback also failed:', e?.message)
              reply = 'দুঃখিত, একটু পরে আবার চেষ্টা করুন।'
            }
          }

          const isDraft = !reply || autoReplyMode === 'off' || autoReplyMode === 'standby'

          // Log conversation
          await logConversation(
            senderId,
            'telegram',
            reply
              ? [
                  { role: 'user', content: messageText, metadata: attachmentMeta },
                  { role: 'assistant', content: reply },
                ]
              : [{ role: 'user', content: messageText, metadata: attachmentMeta }],
            isDraft,
          )

          // Send reply if auto-reply is on
          if (!isDraft && reply) {
            // Try to parse structured reply for product cards
            let parsed: any = null
            try {
              parsed = JSON.parse(reply)
              if (!parsed.messages || !Array.isArray(parsed.messages)) parsed = null
            } catch {}

            if (parsed?.messages) {
              // Structured reply with product cards
              for (const msg of parsed.messages) {
                if (msg.type === 'text' && msg.text) {
                  await sendTelegramMessage(chatId, msg.text, token)
                } else if (msg.type === 'product_card' && msg.product_card) {
                  await sendTelegramProductCard(chatId, token, msg.product_card)
                } else if (msg.type === 'carousel' && msg.cards) {
                  for (const card of msg.cards.slice(0, 5)) {
                    await sendTelegramProductCard(chatId, token, card)
                  }
                }
              }
            } else {
              // Plain text reply
              await sendTelegramMessage(chatId, reply, token)

              // Send product cards if available
              if (productCards && productCards.length > 0) {
                for (const p of productCards.slice(0, 3)) {
                  await sendTelegramProductCard(chatId, token, {
                    name: p.name,
                    price: p.price,
                    image_url: p.image_url,
                    product_url: p.product_url,
                    availability: p.availability,
                    sizes: p.sizes,
                    product_id: String(p.id),
                  })
                }
              }
            }
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          console.error('[telegram] webhook error:', err.message)
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 200, // Always return 200 to Telegram to avoid retries
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
