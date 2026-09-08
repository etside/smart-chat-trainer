'use server'
/**
 * pattern-extractor.server.ts
 * Extracts reusable canned response templates from successful Q&A pairs.
 *
 * Uses DO Inference (openai-gpt-4o) when DO_INFERENCE_KEY / alt_api_keys.do_inference_key
 * is set — much more reliable for structured JSON output than MIMO.
 * Falls back to chatComplete (MIMO gateway) if no DO key available.
 */

import { chatComplete } from './ai.server'

export interface ExtractedTemplate {
  name: string
  template_text: string
  variables: string[]
}

/**
 * Resolve the DO inference key from env or DB.
 * Cached per-process to avoid a DB hit on every extraction.
 */
let _doKeyCache: string | null | undefined = undefined
async function getDoInferenceKey(): Promise<string | null> {
  if (_doKeyCache !== undefined) return _doKeyCache

  // Check env first
  const envKey = process.env['DO_INFERENCE_KEY']
  if (envKey) {
    _doKeyCache = envKey
    return envKey
  }

  // Check DB alt_api_keys
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('agent_settings')
      .select('alt_api_keys')
      .eq('id', 1)
      .maybeSingle()
    const key = (data as any)?.alt_api_keys?.do_inference_key ?? null
    _doKeyCache = key
    return key
  } catch {
    _doKeyCache = null
    return null
  }
}

async function callDoInference(prompt: string): Promise<string> {
  const doKey = await getDoInferenceKey()
  if (!doKey) throw new Error('No DO inference key')

  const res = await fetch('https://inference.do-ai.run/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doKey}`,
    },
    signal: AbortSignal.timeout(20_000), // don't hang on exhausted/slow DO key
    body: JSON.stringify({
      model: 'deepseek-4-flash', // confirmed working on this DO account tier
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DO inference failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}

// Skip extraction for short/trivial answers
// In-process dedup cache
const _extractedCache = new Map<string, ExtractedTemplate>();

export async function extractCannedResponse(
  question: string,
  answer: string
): Promise<ExtractedTemplate> {
  // Skip trivially short answers (acknowledgements etc.) — saves AI call
  if (answer.trim().length < 60) {
    return { name: question.slice(0, 50), template_text: answer, variables: [] };
  }
  // Dedup: same Q+A in this process lifetime
  const cacheKey = `${question.slice(0, 80)}|${answer.slice(0, 80)}`;
  const hit = _extractedCache.get(cacheKey);
  if (hit) return hit;

  const prompt = `You are a customer service template generator. Given a successful customer Q&A pair, create a reusable response template.

Customer question: "${question}"

Agent answer: "${answer}"

Return a JSON object (no markdown, no code fences) with exactly these fields:
{
  "name": "short descriptive name (e.g. 'Shipping inquiry response')",
  "template_text": "The response with variables like {{customer_name}}, {{product_name}}, {{price}}, {{delivery_time}} where appropriate",
  "variables": ["list", "of", "variable", "names", "used"]
}

Rules:
- Keep the template natural and conversational in the same language as the answer
- Replace specific names/prices/dates with variables
- Keep the tone of the original answer
- Name should be 3-6 words max
- Return ONLY the JSON object, nothing else`

  let raw = ''

  // Try DO inference first (much better at structured JSON)
  try {
    raw = await callDoInference(prompt)
    console.log('[pattern-extractor] used DO inference for extraction')
  } catch (doErr) {
    console.warn('[pattern-extractor] DO inference failed, trying Bytez:', (doErr as Error).message)
    // Try Bytez as second option
    try {
      const { bytezChat } = await import('./bytez.server')
      raw = await bytezChat([{ role: 'user', content: prompt }], { maxTokens: 400 })
      console.log('[pattern-extractor] used Bytez chat fallback')
    } catch (bytezErr) {
      console.warn('[pattern-extractor] Bytez failed, trying chatComplete:', (bytezErr as Error).message)
      try {
        // NOTE: pass undefined for model so chatComplete uses its configured
        // default model. Passing an options object here was a bug — it got
        // sent as the model name and returned a 400.
        raw = (await chatComplete([{ role: 'user', content: prompt }], undefined)) as string
      } catch (fallbackErr) {
        console.error('[pattern-extractor] all providers failed:', (fallbackErr as Error).message)
        return {
          name: question.slice(0, 50),
          template_text: answer,
          variables: [],
        }
      }
    }
  }

  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let result: ExtractedTemplate
  try {
    const parsed = JSON.parse(cleaned)
    result = {
      name: String(parsed.name ?? 'Template').slice(0, 100),
      template_text: String(parsed.template_text ?? answer),
      variables: Array.isArray(parsed.variables) ? parsed.variables.map(String) : [],
    }
  } catch {
    // JSON parse failed — return raw answer as fallback template
    result = {
      name: question.slice(0, 50),
      template_text: answer,
      variables: [],
    }
  }

  // Cache the result
  _extractedCache.set(cacheKey, result);
  if (_extractedCache.size > 500) {
    const firstKey = _extractedCache.keys().next().value;
    if (firstKey) _extractedCache.delete(firstKey);
  }

  return result;
}
