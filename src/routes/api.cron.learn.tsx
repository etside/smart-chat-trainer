import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/cron/learn')({
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

          // Fetch A/B test events from last 24h
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          const { data: abEvents } = await supabaseAdmin
            .from('analytics_events')
            .select('metadata')
            .eq('event_type', 'ab_test')
            .gte('created_at', since)

          // Group by templateId → calculate conversion rate
          const templateStats = new Map<string, { sent: number; converted: number }>()
          for (const row of (abEvents ?? [])) {
            const meta = row.metadata as { templateId?: string; outcome?: string }
            if (!meta?.templateId) continue
            const entry = templateStats.get(meta.templateId) ?? { sent: 0, converted: 0 }
            if (meta.outcome === 'sent') entry.sent++
            if (meta.outcome === 'converted') entry.converted++
            templateStats.set(meta.templateId, entry)
          }

          // Also factor in reply_performance events
          const { data: perfEvents } = await supabaseAdmin
            .from('analytics_events')
            .select('metadata')
            .eq('event_type', 'reply_performance')
            .gte('created_at', since)

          for (const row of (perfEvents ?? [])) {
            const meta = row.metadata as { templateId?: string; outcome?: string }
            if (!meta?.templateId) continue
            const entry = templateStats.get(meta.templateId) ?? { sent: 0, converted: 0 }
            if (meta.outcome === 'sent') entry.sent++
            if (meta.outcome === 'converted') entry.converted++
            templateStats.set(meta.templateId, entry)
          }

          let updated = 0
          for (const [templateId, stats] of templateStats) {
            const score = stats.sent > 0
              ? Math.round((stats.converted / stats.sent) * 100)
              : 0

            const { error } = await supabaseAdmin
              .from('auto_reply_templates')
              .update({ performance_score: score })
              .eq('id', templateId)

            if (!error) updated++
          }

          console.log(`[learn] updated ${updated} template scores`)

          // Clean up expired exports (24h TTL)
          try {
            const { cleanupExpiredExports } = await import('@/lib/backup.functions')
            const deleted = await cleanupExpiredExports()
            if (deleted > 0) console.log(`[learn] cleaned ${deleted} expired exports`)
          } catch (cleanupErr: any) {
            console.warn('[learn] export cleanup failed (non-critical):', cleanupErr.message)
          }

          return Response.json({ updated, templatesTracked: templateStats.size })
        } catch (err: any) {
          console.error('[learn] error:', err)
          return Response.json({ error: err.message }, { status: 500 })
        }
      }
    }
  }
})
