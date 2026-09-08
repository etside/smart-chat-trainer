import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { textToSpeech } from '@/lib/tts.functions'

/**
 * POST /api/admin/tts-test
 * Body: { text: string, provider?: 'fish' | 'mimo', modelId?: string }
 * Returns: { audio: string (base64), mimeType: string, format: string, provider: string }
 *
 * Used by the Voice admin page to test TTS before enabling for customers.
 */
export const ttsTest = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z.object({
      text: z.string().min(1).max(2000),
      provider: z.enum(['fish', 'mimo', 'gemini']).default('fish'),
      modelId: z.string().optional(),
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const result = await textToSpeech({ data })
    return result
  })

export const Route = createFileRoute('/api/admin/tts-test')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const parsed = z.object({
            text: z.string().min(1).max(2000),
            provider: z.enum(['fish', 'mimo', 'gemini']).default('fish'),
            modelId: z.string().optional(),
          }).parse(body)

          const result = await textToSpeech({ data: parsed })
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
    }
  }
})
