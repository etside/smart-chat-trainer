'use server'
/**
 * analytics.server.ts
 * Reply performance tracking for the continuous learning loop.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server'

export type ReplyOutcome = 'sent' | 'converted' | 'ignored'

export interface PerformanceSummary {
  templateId: string
  sent: number
  converted: number
  rate: number
}

/** Log the outcome of a reply for performance tracking */
export async function logReplyPerformance(
  sessionId: string,
  templateId: string | null,
  outcome: ReplyOutcome
): Promise<void> {
  await supabaseAdmin.from('analytics_events').insert({
    event_type: 'reply_performance',
    channel: 'internal',
    metadata: { sessionId, templateId, outcome },
  }).catch(console.error)
}

/** Get reply performance summary grouped by templateId */
export async function getReplyPerformanceSummary(): Promise<PerformanceSummary[]> {
  const { data } = await supabaseAdmin
    .from('analytics_events')
    .select('metadata')
    .eq('event_type', 'reply_performance')

  if (!data?.length) return []

  const map = new Map<string, { sent: number; converted: number }>()

  for (const row of data) {
    const meta = row.metadata as { templateId?: string; outcome?: string }
    const id = meta?.templateId ?? 'unknown'
    const entry = map.get(id) ?? { sent: 0, converted: 0 }
    if (meta?.outcome === 'sent') entry.sent++
    if (meta?.outcome === 'converted') entry.converted++
    map.set(id, entry)
  }

  return Array.from(map.entries()).map(([templateId, counts]) => ({
    templateId,
    sent: counts.sent,
    converted: counts.converted,
    rate: counts.sent > 0 ? Math.round((counts.converted / counts.sent) * 100) : 0,
  })).sort((a, b) => b.rate - a.rate)
}
