import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { extractCannedResponse } from '@/lib/pattern-extractor.server'

export const Route = createFileRoute('/api/cron/training-pipeline')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Auth check
          const authHeader = request.headers.get('Authorization')
          const { data: settings } = await supabaseAdmin
            .from('agent_settings')
            .select('cron_secret')
            .eq('id', 1)
            .maybeSingle()

          const cronSecret = settings?.cron_secret
          if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return new Response('Unauthorized', { status: 401 })
          }

          // Fetch LEAD/SOLD labeled approved pairs
          const { data: pairs, error } = await supabaseAdmin
            .from('training_pairs')
            .select('id, question, answer, labels')
            .eq('status', 'approved')
            .or("labels.cs.{LEAD},labels.cs.{SOLD}")
            .limit(50)

          if (error) throw error

          // Overall deadline: 25 seconds — leave room for the HTTP response
          const DEADLINE_MS = 25_000
          const PER_PAIR_TIMEOUT_MS = 10_000
          const startTime = Date.now()

          let processed = 0
          let inserted = 0
          let skipped = 0

          for (const pair of (pairs ?? [])) {
            // Check overall deadline
            if (Date.now() - startTime >= DEADLINE_MS) {
              skipped = (pairs ?? []).length - processed - inserted
              console.warn(`[training-pipeline] deadline reached, skipping ${skipped} remaining pairs`)
              break
            }

            try {
              // Wrap extractCannedResponse with a per-pair timeout
              const template = await withTimeout(
                extractCannedResponse(pair.question, pair.answer),
                PER_PAIR_TIMEOUT_MS,
              )

              // Check if template with same name already exists
              const { data: existing } = await supabaseAdmin
                .from('auto_reply_templates')
                .select('id')
                .eq('name', template.name)
                .maybeSingle()

              if (!existing) {
                await supabaseAdmin.from('auto_reply_templates').insert({
                  name: template.name,
                  platform: 'all',
                  language: 'bn',
                  template_text: template.template_text,
                  variables: template.variables,
                  status: 'published',
                })
                inserted++
              }

              processed++
            } catch (pairErr) {
              skipped++
              console.error('[training-pipeline] pair processing failed:', pairErr)
            }
          }

          // Log run
          await supabaseAdmin.from('auto_training_runs').insert({
            status: 'completed',
            processed_count: processed,
          }).catch(console.error)

          console.log(`[training-pipeline] processed=${processed} inserted=${inserted} skipped=${skipped}`)
          return Response.json({ processed, inserted, skipped })
        } catch (err: any) {
          console.error('[training-pipeline] error:', err)
          return Response.json({ error: err.message }, { status: 500 })
        }
      }
    }
  }
})

/** Returns a promise that rejects if the input doesn't settle within ms. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  })
  try {
    const result = await Promise.race([promise, timeout])
    return result
  } finally {
    clearTimeout(timer)
  }
}