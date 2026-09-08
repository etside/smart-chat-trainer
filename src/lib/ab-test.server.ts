'use server'
/**
 * ab-test.server.ts
 * Deterministic A/B variant assignment and result logging.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server'

/**
 * Assigns A or B variant deterministically based on session+test hash.
 * Same session always gets the same variant for the same test.
 */
export async function assignVariant(sessionId: string, testId: string): Promise<'A' | 'B'> {
  let hash = 0
  const key = `${sessionId}:${testId}`
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B'
}

/**
 * Log an A/B test result for analytics.
 */
export async function logAbResult(
  sessionId: string,
  variant: 'A' | 'B',
  templateId: string,
  outcome: 'sent' | 'converted'
): Promise<void> {
  await supabaseAdmin.from('analytics_events').insert({
    event_type: 'ab_test',
    channel: 'internal',
    metadata: { sessionId, variant, templateId, outcome },
  }).catch(console.error)
}
