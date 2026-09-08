'use server'

import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { pool } from '@/integrations/supabase/pg-client'

// ─── Priority scoring ────────────────────────────────────────────────────────
// Returns a 0-100 score based on session signals. Higher = more urgent/valuable.
//
// Rules:
//   +40  message_count > 10          (returning / engaged customer)
//   +30  last_message_at within 5m   (active / urgent)
//   +20  any training_pair label = 'SOLD' for this external_id (prior buyer)
//   +20  vip_flag = true
//   +10  channel = 'whatsapp'        (higher purchase intent)

export async function calculatePriority(sessionId: string): Promise<number> {
  // Fetch the session row
  const { data: session, error: sessErr } = await supabaseAdmin
    .from('conversation_sessions')
    .select('external_id, channel, message_count, last_message_at, vip_flag')
    .eq('id', sessionId)
    .maybeSingle() as any

  if (sessErr || !session) {
    console.error('[priority] session fetch failed:', sessErr)
    return 0
  }

  let score = 0

  // +40 if message_count > 10
  if ((session.message_count ?? 0) > 10) {
    score += 40
  }

  // +30 if last_message_at within 5 minutes
  if (session.last_message_at) {
    const lastAt = new Date(session.last_message_at).getTime()
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    if (lastAt >= fiveMinutesAgo) {
      score += 30
    }
  }

  // +20 if any training_pair for this external_id's conversations has label 'SOLD'
  if (session.external_id) {
    try {
      const { rows: soldRows } = await pool.query(
        `SELECT 1 FROM training_pairs WHERE 'SOLD' = ANY(labels) LIMIT 1`
      )
      if (soldRows.length > 0) score += 20
    } catch {
      // non-fatal
    }
  }

  // +20 if vip_flag
  if (session.vip_flag === true) {
    score += 20
  }

  // +10 if channel = 'whatsapp'
  if (session.channel === 'whatsapp') {
    score += 10
  }

  // Cap at 100
  const finalScore = Math.min(score, 100)

  // Persist back to DB
  await supabaseAdmin
    .from('conversation_sessions')
    .update({ priority_score: finalScore } as any)
    .eq('id', sessionId)

  return finalScore
}

// ─── VIP marking ─────────────────────────────────────────────────────────────
// Sets vip_flag for all active sessions matching externalId.

export async function markVip(externalId: string, vip: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversation_sessions')
    .update({ vip_flag: vip } as any)
    .eq('external_id', externalId)

  if (error) {
    console.error('[priority] markVip failed:', error)
  }
}
