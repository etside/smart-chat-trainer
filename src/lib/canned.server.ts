'use server'
/**
 * canned.server.ts
 * Canned response management — wraps auto_reply_templates table.
 * The admin UI lives at /admin/canned-responses using auto-replies.functions.ts.
 * This file provides programmatic access for the auto-reply engine.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server'

export interface CannedResponse {
  id: string
  name: string
  platform: string
  language: string
  template_text: string
  variables: string[]
  status: string
  usage_count: number
  performance_score: number
}

/** Fetch a single canned response by ID */
export async function getCannedResponse(id: string): Promise<CannedResponse | null> {
  const { data } = await supabaseAdmin
    .from('auto_reply_templates')
    .select('id, name, platform, language, template_text, variables, status, usage_count, performance_score')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()
  return data as CannedResponse | null
}

/** Render a template by replacing {{variable}} placeholders */
export function renderTemplate(templateText: string, vars: Record<string, string>): string {
  return templateText.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/** Record a canned response was used */
export async function incrementCannedUsage(id: string): Promise<void> {
  await supabaseAdmin.rpc('increment_usage', { row_id: id }).catch(() => {
    // Fallback if RPC not available
    supabaseAdmin
      .from('auto_reply_templates')
      .select('usage_count')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        supabaseAdmin
          .from('auto_reply_templates')
          .update({ usage_count: (data?.usage_count ?? 0) + 1 })
          .eq('id', id)
      })
  })
}

/** Get top performing canned responses ordered by performance_score */
export async function getTopCannedResponses(limit = 10): Promise<CannedResponse[]> {
  const { data } = await supabaseAdmin
    .from('auto_reply_templates')
    .select('id, name, platform, language, template_text, variables, status, usage_count, performance_score')
    .eq('status', 'published')
    .order('performance_score', { ascending: false })
    .limit(limit)
  return (data ?? []) as CannedResponse[]
}
