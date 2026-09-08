'use server'
/**
 * auto-reply.engine.ts v2
 * Improved auto-reply matching with:
 * - Fuzzy keyword matching (handles typos, partial matches)
 * - Better sentiment detection (Bengali + English)
 * - Priority-based rule evaluation
 * - Template scoring for best match selection
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { assignVariant } from './ab-test.server'

export interface AutoReplyResult {
  templateId: string
  templateText: string
  templateName: string
  variant: 'A' | 'B'
  ruleId: string
  ruleName: string
  confidence: number
}

interface Rule {
  id: string
  name: string
  trigger_type: string
  trigger_value: string
  template_id: string
  ab_variant: string | null
  is_active: boolean
  priority_order: number
}

interface Template {
  id: string
  template_text: string
  name: string
}

// ── Fuzzy match helper ───────────────────────────────────────────────────────
// Simple Levenshtein-based fuzzy match for short keywords
function fuzzyMatch(text: string, keyword: string, threshold = 0.75): boolean {
  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase().trim();
  
  // Exact substring match
  if (lowerText.includes(lowerKw)) return true;
  
  // Word-level match: check if any word in text starts with keyword
  const words = lowerText.split(/\s+/);
  if (words.some(w => w.startsWith(lowerKw.slice(0, 4)))) return true;
  
  // For short keywords (<=4 chars), require exact match
  if (lowerKw.length <= 4) return false;
  
  // Levenshtein distance for fuzzy matching
  const len1 = lowerText.length;
  const len2 = lowerKw.length;
  
  // Only fuzzy match if keyword is reasonably close in length
  if (Math.abs(len1 - len2) > 5) return false;
  
  // Simple character overlap ratio
  const chars1 = new Set(lowerText);
  const chars2 = new Set(lowerKw);
  const overlap = [...chars2].filter(c => chars1.has(c)).length;
  const ratio = overlap / Math.max(chars2.size, 1);
  
  return ratio >= threshold;
}

// ── Sentiment detection ──────────────────────────────────────────────────────
const POSITIVE_WORDS = [
  'ধন্যবাদ', 'ভালো', 'সুন্দর', 'চমৎকার', 'দারুণ', 'বাহ', 'অসাধারণ',
  'thanks', 'great', 'good', 'awesome', 'excellent', 'perfect', 'love',
  'happy', 'wonderful', 'amazing', 'best', 'nice', 'beautiful',
  'thank', 'thx', 'ty', 'appreciate'
];

const NEGATIVE_WORDS = [
  'সমস্যা', 'খারাপ', 'অভিযোগ', 'বাজে', 'ভাঙা', 'নষ্ট', 'ফেরত',
  'complaint', 'problem', 'issue', 'bad', 'broken', 'damaged', 'refund',
  'return', 'worst', 'terrible', 'horrible', 'angry', 'disappointed',
  'not working', 'doesn\'t work', 'wrong', 'missing', 'late', 'delay'
];

function detectSentiment(message: string): 'positive' | 'negative' | 'neutral' {
  const lower = message.toLowerCase();
  const posCount = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const negCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

/**
 * Evaluate auto-reply rules for an incoming message.
 * Returns the first matching rule's template, or null if none match.
 */
export async function evaluateAutoReplyRules(
  message: string,
  sessionId: string,
  priority: number
): Promise<AutoReplyResult | null> {
  // Load active rules ordered by priority
  const { data: rules } = await supabaseAdmin
    .from('auto_reply_rules')
    .select('id, name, trigger_type, trigger_value, template_id, ab_variant, is_active, priority_order')
    .eq('is_active', true)
    .order('priority_order', { ascending: false })

  if (!rules?.length) {
    return matchTemplateByKeywords(message, sessionId)
  }

  const lowerMsg = message.toLowerCase()
  const sentiment = detectSentiment(message)

  for (const rule of rules as Rule[]) {
    let matches = false
    let confidence = 0

    if (rule.trigger_type === 'keyword') {
      // Fuzzy keyword matching
      const keywords = rule.trigger_value.split(',').map(k => k.trim()).filter(Boolean);
      const matchedKw = keywords.find(kw => fuzzyMatch(lowerMsg, kw));
      if (matchedKw) {
        matches = true;
        confidence = 0.9;
      }
    } else if (rule.trigger_type === 'priority') {
      const threshold = parseInt(rule.trigger_value, 10);
      if (priority >= threshold) {
        matches = true;
        confidence = Math.min(priority / 100, 1);
      }
    } else if (rule.trigger_type === 'sentiment') {
      if (rule.trigger_value === sentiment) {
        matches = true;
        confidence = 0.7;
      }
    } else if (rule.trigger_type === 'regex') {
      try {
        if (new RegExp(rule.trigger_value, 'i').test(message)) {
          matches = true;
          confidence = 0.95;
        }
      } catch {
        matches = false
      }
    } else if (rule.trigger_type === 'always') {
      matches = true
      confidence = 0.3
    }

    if (!matches) continue

    // Fetch template
    const { data: tmpl } = await supabaseAdmin
      .from('auto_reply_templates')
      .select('id, template_text, name')
      .eq('id', rule.template_id)
      .eq('status', 'published')
      .maybeSingle()

    if (!tmpl) continue

    const template = tmpl as Template

    // Assign A/B variant
    const variant = rule.ab_variant
      ? await assignVariant(sessionId, rule.id)
      : 'A'

    return {
      templateId: template.id,
      templateText: template.template_text,
      templateName: template.name,
      variant,
      ruleId: rule.id,
      ruleName: rule.name,
      confidence,
    }
  }

  return matchTemplateByKeywords(message, sessionId)
}

// ── Direct template trigger_keywords match ────────────────────────────────
export async function matchTemplateByKeywords(
  message: string,
  sessionId: string,
): Promise<AutoReplyResult | null> {
  const { data: templates } = await supabaseAdmin
    .from('auto_reply_templates')
    .select('id, template_text, name, trigger_keywords')
    .eq('status', 'published')
    .not('trigger_keywords', 'is', null)

  if (!templates?.length) return null

  const lowerMsg = message.toLowerCase()
  let bestMatch: AutoReplyResult | null = null
  let bestScore = 0

  for (const tmpl of templates) {
    const keywords: string[] = tmpl.trigger_keywords ?? []
    if (!keywords.length) continue
    
    // Score based on how many keywords match
    const matchedKeywords = keywords.filter((kw: string) => fuzzyMatch(lowerMsg, kw));
    const score = matchedKeywords.length / keywords.length;
    
    if (matchedKeywords.length > 0 && score > bestScore) {
      bestScore = score;
      bestMatch = {
        templateId: tmpl.id,
        templateText: tmpl.template_text,
        templateName: tmpl.name,
        variant: 'A',
        ruleId: 'template_keyword_match',
        ruleName: `keyword match: ${matchedKeywords.join(', ')}`,
        confidence: Math.min(0.5 + score * 0.5, 0.95),
      }
    }
  }

  return bestMatch
}
