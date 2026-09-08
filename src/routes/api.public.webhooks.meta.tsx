import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { generateReply, logConversation } from '@/lib/agent.server'
import { sendMetaMessage } from '@/lib/meta-sender.server'
import { verifyWebhookSignature } from '@/lib/admin.server'
import { extractMessageContent, buildFallbackText } from '@/lib/message-utils'
import { calculatePriority } from '@/lib/priority.server'
import { analyzeImageWithVision } from '@/lib/ai.server'
import { visionCache } from '@/lib/image-cache.server'
import { matchProductsByAttributes, findInStockAlternatives } from '@/lib/catalogue.server'
import { evaluateAutoReplyRules } from '@/lib/auto-reply.engine'
import { logReplyPerformance } from '@/lib/analytics.server'
import { notifyNewMessage, notifyMessageSent, notifyEscalation } from '@/lib/ws-notifications.server'


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

// Build a Messenger generic template element from a product card
function buildProductElement(card: any) {
  const price = card.price != null ? Number(card.price) : 0
  const currency = card.currency || 'BDT'
  const stockLabel = (card.availability || '').toLowerCase().includes('stock')
    ? card.availability
    : card.availability || 'Check availability'
  const featureLines = (card.features || []).slice(0, 3)
  const subtitleParts = [`${currency} ${price.toLocaleString()}`, stockLabel, ...featureLines]

  const buttons: any[] = []
  if (card.product_id) {
    buttons.push({
      type: 'postback',
      title: '\u{1F6D2} Order Now',
      payload: JSON.stringify({
        action: 'order_start',
        product_id: card.product_id,
        product_name: card.title,
        price,
        currency,
      })
    })
  }
  if (card.product_url) {
    buttons.push({ type: 'web_url', url: card.product_url, title: 'View Product' })
  }

  return {
    title: card.title + (card.discount_price ? ` (was ${currency} ${Number(card.discount_price).toLocaleString()})` : ''),
    subtitle: subtitleParts.join('\n'),
    image_url: card.image_url || undefined,
    buttons: buttons.length > 0 ? buttons : undefined,
  }
}

// Send structured rich messages via Meta API
async function sendStructuredMessage(senderId: string, data: any, platform: string, accessToken: string, pageId?: string) {
  const apiUrl = platform === 'whatsapp'
    ? `https://graph.facebook.com/v19.0/${senderId}/messages`
    : `https://graph.facebook.com/v19.0/me/messages`

  for (const msg of data.messages) {
    if (msg.type === 'text') {
      await sendMetaMessage(senderId, msg.text, platform as any)
    } else if (msg.type === 'product_card' && msg.product_card) {
      const element = buildProductElement(msg.product_card)
      const templatePayload = {
        recipient: { id: senderId },
        message: {
          attachment: {
            type: 'template',
            payload: { template_type: 'generic', elements: [element] }
          }
        }
      }
      await fetch(`${apiUrl}?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      })
    } else if (msg.type === 'carousel' && msg.cards?.length) {
      const elements = msg.cards.slice(0, 10).map((card: any) => buildProductElement(card))
      const templatePayload = {
        recipient: { id: senderId },
        message: {
          attachment: {
            type: 'template',
            payload: { template_type: 'generic', elements }
          }
        }
      }
      await fetch(`${apiUrl}?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      })
    } else if (msg.type === 'quick_replies' && msg.quick_replies?.length) {
      const qrPayload = {
        recipient: { id: senderId },
        message: {
          text: msg.text || 'Choose an option:',
          quick_replies: msg.quick_replies.slice(0, 13).map((qr: any) => ({
            content_type: 'text',
            title: qr.title,
            payload: JSON.stringify(qr.payload || { action: 'quick_reply', value: qr.title }),
          }))
        }
      }
      await fetch(`${apiUrl}?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qrPayload)
      })
    } else if (msg.type === 'handoff' && msg.handoff) {
      await sendMetaMessage(senderId, msg.handoff.message, platform as any)
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

// Handle postback from Order Now button
async function handleOrderPostback(senderId: string, payload: any, platform: string, accessToken: string) {
  const { product_id, product_name, price, currency } = payload

  const { data: product } = await supabaseAdmin
    .from('product_catalogue')
    .select('id, name, price, currency, image_url, availability, stock, sizes, variants, product_url, category')
    .eq('id', product_id)
    .maybeSingle()

  if (!product) {
    await sendMetaMessage(senderId, 'Sorry, this product is no longer available. Want to see similar items?', platform as any)
    return
  }

  // Store order context
  const { data: session } = await supabaseAdmin
    .from('conversation_sessions')
    .select('id')
    .eq('external_id', senderId)
    .eq('status', 'active')
    .maybeSingle()

  if (session?.id) {
    await supabaseAdmin.from('session_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: `[Order flow started for: ${product.name} (${product.currency} ${product.price})]`,
      channel: platform,
      metadata: { order_flow: true, product_id: product.id, product_name: product.name, price: product.price }
    })
  }

  const sizes = product.sizes || []
  const apiUrl = platform === 'whatsapp'
    ? `https://graph.facebook.com/v19.0/${senderId}/messages`
    : `https://graph.facebook.com/v19.0/me/messages`

  if (sizes.length > 0) {
    await fetch(`${apiUrl}?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: {
          text: `${product.name} \u2014 ${product.currency} ${Number(product.price).toLocaleString()}\n\u2705 ${product.availability || 'Available'}\n\n\u0995\u09cb\u09a8 \u09b8\u09be\u0987\u099c \u09b2\u09be\u0997\u09ac\u09c7?`,
          quick_replies: sizes.slice(0, 13).map((size: string) => ({
            content_type: 'text',
            title: size,
            payload: JSON.stringify({ action: 'select_size', product_id: product.id, size, product_name: product.name, price: product.price })
          }))
        }
      })
    })
  } else {
    await sendMetaMessage(senderId, `${product.name} \u2014 ${product.currency} ${Number(product.price).toLocaleString()}\n\u2705 ${product.availability || 'Available'}\n\n\u09a0\u09bf\u0995 \u0986\u09aa\u09a8\u09be\u09b0 \u09a0\u09bf\u0995\u09be\u09a8\u09cb \u099c\u09be\u09af\u09bc\u0997\u09be?`, platform as any)
  }
}

// ─── Background message processing ──────────────────────────────────────────
// Runs after the webhook has already responded 200 to Meta.
async function processMetaMessage(params: {
  senderId: string
  messageText: string
  platform: string
  accessToken: string
  pageId?: string
  attachmentMeta?: Record<string, any>
  imageUrl?: string
}) {
  const { senderId, platform } = params
  let { messageText, attachmentMeta } = params

  // ─── Vision: analyze image if present ──────────────────────────────────────
  if (params.imageUrl) {
    try {
      const systemPrompt =
        'You are a fashion product recognition assistant. Analyze the image and respond only with valid JSON.'
      const productContext = ''

      const cached = visionCache.get(params.imageUrl)
      let analysis: Awaited<ReturnType<typeof analyzeImageWithVision>>
      if (cached) {
        analysis = cached
        console.log(`[vision] cache hit for ${params.imageUrl}`)
      } else {
        analysis = await analyzeImageWithVision(params.imageUrl, systemPrompt, productContext)
        if (analysis.summary && !/temporarily unavailable/i.test(analysis.summary)) {
          visionCache.set(params.imageUrl, analysis)
        }
        console.log(`[vision] analyzed image for ${senderId}: ${analysis.summary}`)
      }

      const productMatches = await matchProductsByAttributes({
        color: analysis.color,
        category: analysis.category,
        style: analysis.style,
        fabric: analysis.fabric,
        keywords: analysis.keywords,
      })

      let inStockAlternatives: Awaited<ReturnType<typeof findInStockAlternatives>> = []
      const outOfStock = productMatches.filter(
        (p) => p.availability && /out\s*of\s*stock/i.test(p.availability)
      )
      if (outOfStock.length > 0) {
        try {
          inStockAlternatives = await findInStockAlternatives(
            outOfStock.map((p) => ({ id: p.id, name: p.name, category: p.category })),
            {
              color: analysis.color,
              category: analysis.category,
              style: analysis.style,
              fabric: analysis.fabric,
              keywords: analysis.keywords,
            }
          )
          console.log(
            `[stock] ${outOfStock.length} matched out of stock \u2192 ${inStockAlternatives.length} in-stock suggestions for ${senderId}`
          )
        } catch (altErr: any) {
          console.error('[stock] findInStockAlternatives failed:', altErr?.message || altErr)
        }
      }

      attachmentMeta = {
        ...(attachmentMeta ?? {}),
        visionAnalysis: analysis,
        productMatches,
        inStockAlternatives,
      }

      const matchedNames = productMatches.length > 0
        ? ` Matched products: ${productMatches.map((p) => p.name).join(', ')}.`
        : ''

      let stockContext = ''
      if (outOfStock.length > 0) {
        const oosNames = outOfStock.map((p) => p.name).join(', ')
        stockContext = ` [The following matched product(s) are currently OUT OF STOCK: ${oosNames}.`
        if (inStockAlternatives.length > 0) {
          stockContext += ` Suggest these similar IN-STOCK alternatives instead: ${inStockAlternatives
            .map((a) => `${a.name} (${a.currency} ${a.price})`)
            .join('; ')}.`
        } else {
          stockContext += ` There are no exact similar alternatives in stock; suggest other products from the same category that are available.`
        }
        stockContext += ']'
      }

      const visionContext = `[Image analysis: ${analysis.summary}${matchedNames}${stockContext}]`
      messageText = `${visionContext}\n${messageText}`
    } catch (visionErr: any) {
      console.error('[vision] image analysis failed:', visionErr?.message || visionErr)
    }
  }

  // Generate reply
  let reply: string | null = null
  let salesMetadata: { sentiment?: any; leadScore?: any; escalated?: boolean } = {}

  try {
    const { data: sessionRow } = await supabaseAdmin
      .from('conversation_sessions')
      .select('id, external_id')
      .eq('external_id', senderId)
      .eq('status', 'active')
      .maybeSingle() as any

    const { processSalesMessage } = await import('@/lib/sales-agent.server')
    const salesResult = await processSalesMessage({
      message: messageText,
      conversationId: null,
      sessionId: sessionRow?.id ?? null,
      externalId: senderId,
      channel: platform,
      history: [],
      generateReplyFn: async (msg, hist) => {
        const { generateReply } = await import('@/lib/agent.server')
        return generateReply(msg, hist)
      },
    })
    reply = salesResult.reply
    salesMetadata = {
      sentiment: salesResult.sentiment,
      leadScore: salesResult.leadScore,
      escalated: salesResult.escalated,
    }
    if (salesResult.escalated) {
      console.log(`[sales] escalated ${senderId} \u2014 ${salesResult.escalationMessage}`)
    }
    console.log(`[sales] lead=${salesResult.leadScore.tier}(${salesResult.leadScore.score}) sentiment=${salesResult.sentiment.sentiment}`)
  } catch (aiError: any) {
    console.error('[sales] processSalesMessage failed, falling back:', aiError?.message)
    try {
      const { generateReply } = await import('@/lib/agent.server')
      const generated = await generateReply(messageText, [])
      reply = generated.reply
    } catch (e: any) {
      console.error('generateReply fallback also failed:', e?.message)
    }
  }

  const { data: settingsRow } = await supabaseAdmin
    .from('agent_settings')
    .select('auto_reply_mode')
    .eq('id', 1)
    .maybeSingle()
  let autoReplyMode = (settingsRow as any)?.auto_reply_mode || 'off'

  const isDraft = !reply || autoReplyMode === 'off' || autoReplyMode === 'standby'

  // Notify WebSocket clients of new incoming message
  try {
    notifyNewMessage({
      sessionId: sessionRow?.id || '',
      externalId: senderId,
      channel: platform,
      content: messageText,
      customerName: customerName || undefined,
      timestamp: new Date().toISOString(),
    })
  } catch {}

  await logConversation(
    senderId,
    platform,
    reply
      ? [
          { role: 'user', content: messageText, metadata: attachmentMeta ?? null },
          { role: 'assistant', content: reply }
        ]
      : [{ role: 'user', content: messageText, metadata: attachmentMeta ?? null }],
    isDraft
  )

  // Resolve real sender name from Meta Graph API (fire-and-forget)
  void (async () => {
    try {
      const { fetchSenderName } = await import('@/lib/meta-sender.server')
      const senderName = await fetchSenderName(senderId, params.accessToken, params.pageId)
      if (senderName) {
        await supabaseAdmin
          .from('conversation_sessions')
          .update({ customer_name: senderName })
          .eq('external_id', senderId)
          .is('customer_name', null)
        console.log(`[name] resolved ${senderId} \u2192 ${senderName}`)
      }
    } catch (e) {}
  })()

  // Priority scoring
  try {
    const { data: sessionRow } = await supabaseAdmin
      .from('conversation_sessions')
      .select('id')
      .eq('external_id', senderId)
      .eq('status', 'active')
      .maybeSingle() as any

    if (sessionRow?.id) {
      const score = await calculatePriority(sessionRow.id)
      if (score >= 70) {
        console.log(`[priority] HIGH priority session ${senderId} score=${score}`)
      }
      if (score >= 90) {
        autoReplyMode = 'off'
        console.log(`[priority] score=${score} >= 90 \u2014 auto-reply suppressed for ${senderId}`)
      }
    }
  } catch (priorityErr) {
    console.error('[priority] calculatePriority error:', priorityErr)
  }

  if (!reply) {
    await supabaseAdmin.from('webhook_logs').insert({
      event_type: 'ai_reply_failed',
      payload: { sender: senderId, message: messageText, platform },
      source: platform,
      processing_status: 'failed',
      error_details: 'AI reply generation failed (check AI provider credits/config)'
    })
    console.log(`[webhook] AI unavailable \u2014 user message logged for ${senderId}`)
    return
  }

  if (autoReplyMode === 'off' || autoReplyMode === 'standby') {
    console.log(`[auto-reply] ${autoReplyMode.toUpperCase()} \u2014 draft stored for ${senderId}`)
    await supabaseAdmin.from('webhook_logs').insert({
      event_type: 'ai_draft_reply',
      source: platform,
      direction: 'outbound',
      processing_status: 'pending_approval',
      payload: {
        sender: senderId,
        message: messageText,
        draft_reply: reply,
        platform,
        conversation_id: senderId,
      },
    }).catch((e: any) => console.error('[draft] failed to store draft:', e?.message))
    await logReplyPerformance(senderId, null, 'ignored').catch(() => {})
  } else {
    let sentTemplateId: string | null = null
    try {
      const { data: sessionForRule } = await supabaseAdmin
        .from('conversation_sessions')
        .select('id, priority_score')
        .eq('external_id', senderId)
        .maybeSingle() as any
      const priorityScore = sessionForRule?.priority_score ?? 0
      const ruleMatch = sessionForRule?.id
        ? await evaluateAutoReplyRules(messageText, sessionForRule.id, priorityScore)
        : null

      if (ruleMatch) {
        await sendMetaMessage(senderId, ruleMatch.templateText, platform as any)
        sentTemplateId = ruleMatch.templateId
        console.log(`[auto-reply] rule matched: ${ruleMatch.ruleName} \u2192 template: ${ruleMatch.templateName}`)
      } else {
        const parsed = parseStructuredReply(reply)
        if (parsed.type === 'structured' && params.accessToken) {
          await sendStructuredMessage(senderId, parsed.data, platform, params.accessToken, params.pageId)
        } else {
          await sendMetaMessage(senderId, reply, platform as any)
        }
      }
      await logReplyPerformance(senderId, sentTemplateId, 'sent').catch(() => {})

      // ── Voice reply (async, non-blocking) ──────────────────────────────────
      try {
        const { data: voiceSettings } = await supabaseAdmin
          .from('agent_settings')
          .select('voice_provider, selected_voice_clone_id, fish_audio_api_key, fish_audio_model_id')
          .eq('id', 1)
          .maybeSingle() as any

        if (voiceSettings?.voice_provider && voiceSettings?.fish_audio_api_key && voiceSettings?.selected_voice_clone_id) {
          const voiceReplyText = ruleMatch ? ruleMatch.templateText : reply
          if (voiceReplyText && voiceReplyText.length <= 2000) {
            // Generate TTS audio
            const { data: clone } = await supabaseAdmin
              .from('voice_clones')
              .select('reference_id, voice_id')
              .eq('id', voiceSettings.selected_voice_clone_id)
              .maybeSingle() as any

            const voiceId = clone?.reference_id || clone?.voice_id || voiceSettings.fish_audio_model_id
            if (voiceId) {
              const ttsRes = await fetch('https://api.fish.audio/v1/tts', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${voiceSettings.fish_audio_api_key}`,
                },
                body: JSON.stringify({
                  text: voiceReplyText,
                  reference_id: voiceId,
                  format: 'mp3',
                }),
                signal: AbortSignal.timeout(15000),
              })

              if (ttsRes.ok) {
                const audioBuffer = await ttsRes.arrayBuffer()
                const audioBase64 = Buffer.from(audioBuffer).toString('base64')
                const { sendVoiceMessage } = await import('@/lib/meta-sender.server')
                await sendVoiceMessage(senderId, audioBase64, 'audio/mpeg', platform as any)
                console.log(`[voice] sent voice reply to ${senderId}`)
              } else {
                console.warn(`[voice] TTS failed: ${ttsRes.status}`)
              }
            }
          }
        }
      } catch (voiceErr: any) {
        console.warn('[voice] voice reply failed (non-fatal):', voiceErr?.message || voiceErr)
      }
    } catch (sendError) {
      console.error('Failed to send Meta message:', sendError)
    }
  }
}

// ─── Redelivery dedupe ───────────────────────────────────────────────────────
const processedEvents = new Map<string, number>()
const DEDUPE_TTL_MS = 10 * 60 * 1000

function isDuplicateEvent(key: string): boolean {
  const now = Date.now()
  for (const [k, t] of processedEvents) {
    if (now - t > DEDUPE_TTL_MS) processedEvents.delete(k)
  }
  if (processedEvents.has(key)) return true
  processedEvents.set(key, now)
  return false
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

          // Dedup: skip already-processed events
          const eventId = body.entry?.[0]?.messaging?.[0]?.message?.mid
            || body.entry?.[0]?.changes?.[0]?.value?.message_id
            || body.entry?.[0]?.id;
          if (eventId && isDuplicateEvent(eventId)) {
            return new Response('EVENT_RECEIVED')
          }

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

              // Handle postback (Order Now button clicks)
              const postback = changes.postback || entry?.messaging?.[0]?.postback
              if (postback?.payload && senderId) {
                try {
                  const payload = JSON.parse(postback.payload)
                  if (payload.action === 'order_start') {
                    const platformToken = settings?.meta_access_token ?? ''
                    void handleOrderPostback(senderId, payload, platform, platformToken)
                      .catch((err) => console.error('[postback] order handling failed:', err))
                    return new Response('EVENT_RECEIVED')
                  }
                } catch {}
              }

              // Handle quick reply payload (size/color selection)
              const quickReply = changes.message?.quick_reply
              if (quickReply?.payload && senderId) {
                try {
                  const payload = JSON.parse(quickReply.payload)
                  if (payload.action === 'select_size') {
                    const sizeMsg = `Customer selected size: ${payload.size} for ${payload.product_name}`
                    void processMetaMessage({
                      senderId, messageText: sizeMsg, platform,
                      accessToken: settings?.meta_access_token ?? '', pageId: settings?.meta_page_id,
                    }).catch((err) => console.error('[quick_reply] processing failed:', err))
                    return new Response('EVENT_RECEIVED')
                  }
                } catch {}
              }

              // Extract structured content from message (text, image, audio, etc.)
              const rawMsg = changes.message || changes.messages?.[0] || {}
              const extracted = extractMessageContent(rawMsg)
              const messageText = buildFallbackText(extracted)

              const fieldType = entry?.changes?.[0]?.field
              let platform = 'messenger'
              if (body.object === 'whatsapp_business_account') platform = 'whatsapp'
              else if (fieldType === 'messages' && changes.message?.is_echo === undefined) {
                if (changes.from && /^\d+$/.test(changes.from) && senderId !== changes.from) {
                  platform = 'instagram'
                }
              }

              if (senderId && messageText) {
                const dedupeKey = String(
                  changes.timestamp
                    ?? changes.message?.mid
                    ?? changes.messages?.[0]?.id
                    ?? `${senderId}:${messageText}`,
                )
                if (isDuplicateEvent(dedupeKey)) {
                  console.log(`[webhook] duplicate event skipped (${dedupeKey.slice(0, 40)})`)
                  return new Response('EVENT_RECEIVED')
                }

                const platformToken = settings?.meta_access_token ?? ''
                const platformPageId = settings?.meta_page_id
                void processMetaMessage({
                  senderId, messageText, platform,
                  accessToken: platformToken, pageId: platformPageId,
                  attachmentMeta: Object.keys(extracted.rawMeta).length > 0 ? extracted.rawMeta : undefined,
                  imageUrl: extracted.imageUrl ?? undefined,
                }).catch((err) => console.error('[webhook] background processing failed:', err))
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
