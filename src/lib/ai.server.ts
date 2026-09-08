// ─── Provider priority ────────────────────────────────────────────────────────
// 1. OrcaRouter (free tier, 191 models, OpenAI-compatible)  ← PRIMARY
// 2. MiMo / custom gateway (legacy fallback)
// 3. DB overrides always win (admin settings)

const ORCA_GATEWAY = "https://api.orcarouter.ai/v1";
const ORCA_DEFAULT_MODEL = "qwen3.8-flash";
const ORCA_FREE_MODELS = [
  "qwen/qwen3.8-27b-free",
  "deepseek/deepseek-v4-flash-free",
  "tencent/hy3-free",
] as const;

const DEFAULT_GATEWAY = process.env["AI_GATEWAY_URL"] || ORCA_GATEWAY;
const ENV_API_KEY = process.env["ORCA_API_KEY"] || process.env["MIMO_API_KEY"] || "";

export type AiConfig = {
  baseUrl: string;
  apiKey: string | null;
  model: string | null;
};

// Short-TTL cache so we don't hit the DB on every AI call, while still
// picking up provider changes from Settings within ~30s on all workers.
let _configCache: { cfg: AiConfig; at: number } | null = null;

/** Rotate API key on quota/billing failure. Returns true if a backup key was swapped in. */
export function rotateApiKey(): boolean {
  if (!_configCache) return false;
  const alt = (_configCache.cfg as any).altApiKeys;
  if (!alt?.b.ai_backup) return false;
  const currentKey = _configCache.cfg.apiKey;
  if (currentKey === alt.b.ai_backup) return false; // already on backup
  console.log("[AI] rotating API key: primary quota exhausted, switching to backup");
  _configCache.cfg.apiKey = alt.b.ai_backup;
  // Swap primary/backup in altApiKeys for next rotation
  alt.b.ai_backup = currentKey;
  alt.b.ai_primary = alt.b.ai_primary === currentKey ? alt.b.ai_primary : alt.b.ai_backup;
  return true;
}
const CONFIG_TTL_MS = 120_000; // 2 min — agent_settings changes rarely

async function getAiConfig(): Promise<AiConfig> {
  if (_configCache && Date.now() - _configCache.at < CONFIG_TTL_MS) {
    return _configCache.cfg;
  }
  const cfg: AiConfig = {
    baseUrl: DEFAULT_GATEWAY,
    apiKey: ENV_API_KEY || null,
    model: ORCA_DEFAULT_MODEL,   // default to free model; DB override wins below
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("agent_settings")
      .select("ai_base_url, ai_api_key, model, lovable_api_key_override, alt_api_keys")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      if (data.ai_base_url) cfg.baseUrl = String(data.ai_base_url).trim().replace(/\/+$/, "");
      const dbKey = data.ai_api_key || data.lovable_api_key_override;
      if (dbKey) cfg.apiKey = String(dbKey);
      if (data.model) cfg.model = String(data.model);
      if (data.alt_api_keys) (cfg as any).altApiKeys = data.alt_api_keys;
    }
  } catch (err) {
    console.error("[AI] failed to load provider config from DB, using env fallback:", err);
  }
  _configCache = { cfg, at: Date.now() };
  return cfg;
}


// ─── OrcaRouter helpers (exported for admin settings UI) ──────────────────
export const ORCA_ROUTER_CONFIG = {
  baseUrl: ORCA_GATEWAY,
  defaultModel: ORCA_DEFAULT_MODEL,
  freeModels: ORCA_FREE_MODELS,
  allModels: [
    { id: "qwen/qwen3.8-27b-free",        label: "Qwen 3.8 27B (FREE)",    cost: "free" },
    { id: "deepseek/deepseek-v4-flash-free", label: "DeepSeek V4 Flash (FREE)", cost: "free" },
    { id: "tencent/hy3-free",              label: "HunyuanLarge 3 (FREE)",  cost: "free" },
    { id: "orcarouter/fusion-mini",        label: "OrcaRouter Fusion Mini",   cost: "paid" },
    { id: "orcarouter/fusion-flash",       label: "OrcaRouter Fusion Flash",  cost: "paid" },
    { id: "orcarouter/fusion",             label: "OrcaRouter Fusion",        cost: "paid" },
    { id: "orcarouter/auto",               label: "OrcaRouter Auto (smart)",  cost: "paid" },
    { id: "deepseek/deepseek-v4-flash",    label: "DeepSeek V4 Flash",       cost: "paid" },
    { id: "google/gemini-2.5-flash",       label: "Gemini 2.5 Flash",        cost: "paid" },
    { id: "google/gemini-3.5-flash",       label: "Gemini 3.5 Flash",        cost: "paid" },
    { id: "openai/gpt-4o-mini",            label: "GPT-4o Mini",             cost: "paid" },
    { id: "openai/gpt-4o",                 label: "GPT-4o",                  cost: "paid" },
    { id: "anthropic/claude-haiku-4.5",    label: "Claude Haiku 4.5",        cost: "paid" },
  ],
} as const;
export function clearAiConfigCache() {
  _configCache = null;
}

async function getApiKey(override?: string | null, cfg?: AiConfig) {
  const config = cfg ?? (await getAiConfig());
  if (override) return override;
  if (config.apiKey) return config.apiKey;
  throw new Error("AI is not configured (no API key set in Settings or MIMO_API_KEY env).");
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// 429 retry schedule: providers like Zhipu/GLM rate-limit aggressively.
// Retries (1s, 3s, 8s) absorb short bursts; Retry-After header wins if set.
// NOTE: keep attempts LOW and bounded. Free tiers are usually rate-limited for
// 30-60s at a time, so long per-model retry loops just pile up CPU + heap under
// concurrent webhooks. One short retry per model, then move on — faster.
const RATE_LIMIT_RETRY_DELAYS_MS = [1000, 3000];

// Providers also enforce a minimum interval between requests. Space outbound
// AI calls per process through a chained queue (mutex) so concurrent webhook
// messages don't fire simultaneously.
const AI_MIN_GAP_MS = 1500;
let aiLastStart = 0;
let aiQueue: Promise<void> = Promise.resolve();

function acquireAiSlot(): Promise<void> {
  const task = aiQueue.then(async () => {
    const wait = aiLastStart + AI_MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    aiLastStart = Date.now();
  });
  aiQueue = task.catch(() => {});
  return task;
}

/**
 * Fallback #1 when Orca free tier is rate-limited.
 * Uses the FREE Gemini tier (GEMINI_API_KEY) via its OpenAI-compatible
 * endpoint before spending money on the chatbai/deepseek paid fallback.
 * Returns null when no Gemini key is set or the call fails.
 */
async function tryGeminiFallback(
  body: { model: string; messages: ChatMessage[]; stream: boolean }
): Promise<string | ReadableStream | null> {
  const geminiKey = process.env["GEMINI_API_KEY"] || null;
  if (!geminiKey) {
    return null; // no Gemini key — let the caller move to the paid fallback
  }
  // Default to a free-tier-capable Gemini model; admin can override via DB if desired.
  const geminiModel = process.env["GEMINI_CHAT_MODEL"] || "gemini-3.6-flash";
  try {
    console.warn(`[AI] Orca free exhausted — trying Gemini free fallback (${geminiModel})`);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${geminiKey}`,
        },
        body: JSON.stringify({ ...body, model: geminiModel }),
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!res.ok) {
      console.warn(`[AI] Gemini fallback failed: ${res.status} ${(await res.text()).slice(0, 120)}`);
      return null;
    }
    if (body.stream && res.body) return res.body;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
    };
    const msg = json.choices?.[0]?.message;
    const text = msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
    return text || null;
  } catch (err: any) {
    console.warn(`[AI] Gemini fallback error: ${err.message}`);
    return null;
  }
}

/**
 * Fallback #2 when Orca free tier and Gemini are both exhausted.
 * Uses OpenRouter's free tier (OPENROUTER_API_KEY) — minimax/minimax-m3:free
 * verified working 2026-09-04. Returns null when no key is set or the call fails.
 */
async function tryOpenRouterFallback(
  body: { model: string; messages: ChatMessage[]; stream: boolean }
): Promise<string | ReadableStream | null> {
  const orKey = process.env["OPENROUTER_API_KEY"] || null;
  if (!orKey) {
    return null; // no OpenRouter key — let the caller move to the paid fallback
  }
  const orModel = process.env["OPENROUTER_CHAT_MODEL"] || "minimax/minimax-m3:free";
  // Single-shot fallback: a momentary per-minute 429 is common, so allow a short
  // in-call retry before declaring failure (≤ 4s total, never stall the request).
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.warn(`[AI] Gemini exhausted — trying OpenRouter free fallback (${orModel}, attempt ${attempt + 1})`);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orKey}`,
        },
        body: JSON.stringify({ ...body, model: orModel }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const ra = Number(res.headers.get("retry-after"));
        const wait = Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500, 2_000);
        console.warn(`[AI] OpenRouter 429 (attempt ${attempt + 1}), backing off ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        console.warn(`[AI] OpenRouter fallback failed: ${res.status} ${(await res.text()).slice(0, 120)}`);
        return null;
      }
      if (body.stream && res.body) return res.body;
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
      };
      const msg = json.choices?.[0]?.message;
      const text = msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
      return text || null;
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.warn(`[AI] OpenRouter fallback error: ${err.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Fallback when the primary provider (Orca free tier) is rate-limited.
 * Tries the FREE Gemini tier first, then the chatbai/deepseek key stored in
 * agent_settings.alt_api_keys so customer messages still get answered during
 * free-tier outages without spending money when Gemini free is available.
 */
async function tryAltApiFallback(
  body: { model: string; messages: ChatMessage[]; stream: boolean },
  messages: ChatMessage[],
  stream: boolean
): Promise<string | ReadableStream | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("agent_settings")
      .select("alt_api_keys, ai_api_key, ai_base_url")
      .eq("id", 1)
      .maybeSingle();
    const alt = (data?.alt_api_keys as Record<string, any>) ?? {};

    const chatBaiKey = process.env["CHATBAI_API_KEY"] || alt.chatbai_key || null;
    if (!chatBaiKey) {
      console.warn("[AI] No chatbai fallback key configured, cannot recover from rate limit");
      return null;
    }
    const chatBaiBase = (alt.chatbai_base_url || process.env["CHATBAI_BASE_URL"] || "https://api.b.ai/v1").replace(/\/+$/, "");
    // B.AI free model cascade: hy3 (reasoning) → qwen3.8-flash (fast) → glm-5.3-flash
    const BAI_FREE_MODELS = ["hy3", "qwen3.8-flash", "glm-5.3-flash"];

    for (const baiModel of BAI_FREE_MODELS) {
      try {
        console.warn(`[AI] Orca free exhausted — trying b.ai/${baiModel}`);
        const res = await fetch(`${chatBaiBase}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${chatBaiKey}`,
          },
          body: JSON.stringify({ ...body, model: baiModel }),
          signal: AbortSignal.timeout(25_000),
        });

        if (!res.ok) {
          const errText = (await res.text()).slice(0, 120);
          console.warn(`[AI] b.ai/${baiModel} failed: ${res.status} ${errText}`);
          continue;
        }
        if (stream && res.body) return res.body;
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> };
        const msg = json.choices?.[0]?.message;
        const text = msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
        if (text) return text;
        console.warn(`[AI] b.ai/${baiModel} returned empty content, trying next`);
      } catch (modelErr: any) {
        console.warn(`[AI] b.ai/${baiModel} error: ${(modelErr as Error).message}`);
      }
    }

    console.warn("[AI] All b.ai fallback models exhausted");
    return null;
  } catch (err: any) {
    console.warn(`[AI] chatbai fallback error: ${(err as Error).message}`);
    return null;
  }
}

export async function chatComplete(
  messages: ChatMessage[],
  model?: string,
  apiKeyOverride?: string | null,
  stream = false
): Promise<string | ReadableStream> {
  const cfg = await getAiConfig();
  const resolvedModel = model || cfg.model || "mimo-v2.5";
  const apiKey = await getApiKey(apiKeyOverride, cfg);

  const body = {
    model: resolvedModel,
    messages,
    stream
  };

  // Rotate through free models on 429 to avoid single-model rate limits
  const modelsToTry = cfg.baseUrl === ORCA_GATEWAY && ORCA_FREE_MODELS.includes(resolvedModel as any)
    ? [...new Set([resolvedModel, ...ORCA_FREE_MODELS])]
    : [resolvedModel];

  let res!: Response;
  let modelUsed = resolvedModel;
  outerLoop: for (const tryModel of modelsToTry) {
    modelUsed = tryModel;
    body.model = tryModel;
    for (let attempt = 0; ; attempt++) {
      await acquireAiSlot();
      try {
        res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (fetchErr: any) {
        console.warn(`[AI] fetch error on ${cfg.baseUrl}/${tryModel}: ${fetchErr.message}`);
        // Network error — try next free model if on Orca, else fail
        if (cfg.baseUrl === ORCA_GATEWAY && ORCA_FREE_MODELS.includes(tryModel as any)) {
          continue outerLoop;
        }
        throw new Error(`AI network error: ${fetchErr.message}`);
      }

      if (res.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
        const retryAfter = Number(res.headers.get("retry-after"));
        // Cap total wait: free tiers often rate-limit for 30-60s, so never let
        // Retry-After drag a single call into a long stall. 3s max, then move on.
        const delay = Math.min(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_RETRY_DELAYS_MS[attempt],
          3_000
        );
        console.warn(`[AI] 429 on ${tryModel} (attempt ${attempt + 1}), retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (res.status === 429) {
        console.warn(`[AI] ${tryModel} rate limited, trying next free model...`);
        continue outerLoop;  // try next model
      }
      break outerLoop;
    }
  }

  if (res.status === 429) {
    // ── Fallback chain (cheapest first) ───────────────────────────────────
    // Orca free tier exhausted.
    // 1) Gemini free → 2) OpenRouter free (no spend) → 3) chatbai/deepseek paid (alt_api_keys).
    // This keeps the AI replying to customers and spends money only when
    // both free tiers are unavailable or also fail.
    const geminiFallback = await tryGeminiFallback(body);
    if (geminiFallback) return geminiFallback;
    const openRouterFallback = await tryOpenRouterFallback(body);
    if (openRouterFallback) return openRouterFallback;
    const fallback = await tryAltApiFallback(body, messages, stream);
    if (fallback) return fallback;
    throw new Error("RATE_LIMIT");
  }
  if (res.status === 402) {
    const { rotateApiKey } = await import("@/lib/ai.server");
    if (rotateApiKey()) {
      console.log("[AI] key rotated on 402, retrying entire call...");
      return chatComplete(messages, { ...params, apiKey: undefined }, stream);
    }
    throw new Error("NO_CREDITS");
  }
  if (!res.ok) {
    const text = await res.text();
    if ((res.status === 401 || res.status === 403 || text.includes("insufficient") || text.includes("quota") || text.includes("credit")) && cfg.baseUrl.includes("b.ai")) {
      const { rotateApiKey } = await import("@/lib/ai.server");
      if (rotateApiKey()) {
        console.log("[AI] key rotated on " + res.status + ", retrying entire call...");
        return chatComplete(messages, { ...params, apiKey: undefined }, stream);
      }
    }
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  if (stream && res.body) {
    return res.body;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  // OrcaRouter thinking models (deepseek, qwen) may return reasoning_content instead of content
  const msg = json.choices?.[0]?.message;
  const result = msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
  return result;
}

export async function transcribeAudio(
  base64Audio: string,
  mimeType: string,
  apiKeyOverride?: string | null,
): Promise<string> {
  const binary = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0))
  const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm'

  // ── Try DO Inference Whisper first ────────────────────────────────────────
  const doKey = process.env['DO_INFERENCE_KEY']
  if (doKey) {
    try {
      const form = new FormData()
      form.append('file', new Blob([binary], { type: mimeType }), `audio.${ext}`)
      form.append('model', 'whisper-large-v3')
      form.append('language', 'bn')
      form.append('response_format', 'json')

      const res = await fetch('https://inference.do-ai.run/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${doKey}` },
        body: form,
      })

      if (res.ok) {
        const json = (await res.json()) as { text?: string }
        const text = (json.text ?? '').trim()
        if (text) {
          console.log('[transcribe] used DO whisper-large-v3')
          return text
        }
      }
      // 404 = model not available on this tier, fall through to MIMO
      if (res.status !== 404 && res.status !== 403) {
        const err = await res.text()
        console.warn('[transcribe] DO whisper failed:', res.status, err.slice(0, 100))
      }
    } catch (e: any) {
      console.warn('[transcribe] DO whisper error:', e.message)
    }
  }

  // ── Fallback: MIMO ASR ─────────────────────────────────────────────────────
  const form = new FormData()
  form.append('file', new Blob([binary], { type: mimeType }), `audio.${ext}`)
  form.append('model', 'mimo-v2.5-asr')
  form.append('prompt', 'ট্রান্সক্রিপ্টটি দ্রুত ও নির্ভুলভাবে বাংলা বা বাংলিশে করুন। (Transcribe quickly and accurately in Bengali or Banglish.)')

  const cfg = await getAiConfig()
  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getApiKey(apiKeyOverride, cfg)}` },
    body: form,
  })

  if (res.status === 429) throw new Error('RATE_LIMIT')
  if (res.status === 402) throw new Error('NO_CREDITS')
  if (!res.ok) {
    const errText = await res.text()
    // ── Bytez ASR fallback ────────────────────────────────────────────────
    try {
      console.warn('[transcribe] MIMO failed, trying Bytez ASR fallback')
      const { bytezTranscribe } = await import('./bytez.server')
      const base64Data = `data:${mimeType};base64,${base64Audio}`
      const text = await bytezTranscribe({ base64: base64Data })
      console.log('[transcribe] used Bytez ASR fallback')
      return text
    } catch (bytezErr: any) {
      console.error('[transcribe] Bytez ASR fallback failed:', bytezErr.message)
    }
    throw new Error(`Transcription failed (${res.status}): ${errText.slice(0, 300)}`)
  }

  const json = (await res.json()) as { text?: string }
  return (json.text ?? '').trim()
}

// Small connectivity test used by Settings ("Test connection"): validates
// whatever provider the user configured (key + base URL + model).
export async function testAiConnection(
  baseUrl?: string | null,
  apiKey?: string | null,
  model?: string | null
): Promise<{ ok: boolean; model?: string; error?: string }> {
  try {
    const cfg: AiConfig = {
      baseUrl: (baseUrl || DEFAULT_GATEWAY).trim().replace(/\/+$/, ""),
      apiKey: apiKey || ENV_API_KEY || null,
      model: model || null,
    };
    const resolvedModel = cfg.model || ORCA_DEFAULT_MODEL;
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getApiKey(null, cfg)}`,
      },
      body: JSON.stringify({ model: resolvedModel, messages: [{ role: "user", content: "ping" }], max_tokens: 5 }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, model: resolvedModel };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ─── Vision Analysis ─────────────────────────────────────────────────────────

export interface VisionAnalysis {
  color?: string
  pattern?: string
  fabric?: string
  style?: string
  fit?: string
  category?: string
  keywords: string[]
  summary: string
}

/**
 * Analyze an image URL using a vision-capable model.
 *
 * Priority:
 *   1. OpenRouter (free vision models) — key from env OPENROUTER_API_KEY
 *      — free model: minimax/minimax-m3:free (verified working)
 *   2. chat.b.ai (OpenAI-compatible) with glm-5.3-flash (free b.ai)
 *      — key from env CHATBAI_API_KEY or agent_settings.alt_api_keys.chatbai_key
 *   3. DigitalOcean Inference (inference.do-ai.run) with kimi-k3
 *      — key from agent_settings.alt_api_keys.do_inference_key or env DO_INFERENCE_KEY
 *   4. OpenAI directly — key from env OPENAI_API_KEY
 *   5. MIMO gateway fallback (mimo-v2.5 supports vision via external gateway)
 */
export async function analyzeImageWithVision(
  imageUrl: string,
  systemPrompt: string,
  productContext: string
): Promise<VisionAnalysis> {
  const cfg = await getAiConfig()

  // ── Resolve alternate keys from env or DB alt_api_keys ────────────────────
  let dbAltKeys: Record<string, any> | null = null
  try {
    const { data: s } = await (await import('@/integrations/supabase/client.server')).supabaseAdmin
      .from('agent_settings')
      .select('alt_api_keys')
      .eq('id', 1)
      .maybeSingle()
    dbAltKeys = (s as any)?.alt_api_keys ?? null
  } catch { /* non-fatal */ }

  const openRouterKey = process.env['OPENROUTER_API_KEY'] || null
  const chatBaiKey = process.env['CHATBAI_API_KEY'] || dbAltKeys?.chatbai_key || null
  const chatBaiBaseUrl = (process.env['CHATBAI_BASE_URL'] || dbAltKeys?.chatbai_base_url || 'https://api.b.ai/v1').replace(/\/+$/, '')
  const chatBaiModel = dbAltKeys?.chatbai_model || process.env['CHATBAI_MODEL'] || 'glm-5.3-flash (free b.ai)'

  const doKey = process.env['DO_INFERENCE_KEY'] || dbAltKeys?.do_inference_key || null

  // ── Pick provider ─────────────────────────────────────────────────────────
  let baseUrl: string
  let apiKey: string
  let model: string

  if (openRouterKey) {
    // OpenRouter — free vision models (minimax/minimax-m3:free verified working)
    baseUrl = 'https://openrouter.ai/api/v1'
    apiKey = openRouterKey
    model = 'minimax/minimax-m3:free'
    console.log('[vision] using OpenRouter minimax-m3 (free)')
  } else if (chatBaiKey) {
    // chat.b.ai — glm-5.3-flash (free b.ai) (native multimodal vision)
    baseUrl = chatBaiBaseUrl
    apiKey = chatBaiKey
    model = chatBaiModel
    console.log(`[vision] using chat.b.ai ${model}`)
  } else if (doKey) {
    // DigitalOcean Inference — kimi-k3 (DO-hosted, native vision, no OpenAI subscription needed)
    baseUrl = 'https://inference.do-ai.run/v1'
    apiKey = doKey
    model = 'kimi-k3'
    console.log('[vision] using DigitalOcean inference kimi-k3')
  } else if (process.env['OPENAI_API_KEY']) {
    // Direct OpenAI fallback
    baseUrl = 'https://api.openai.com/v1'
    apiKey = process.env['OPENAI_API_KEY']!
    model = 'gpt-4o'
    console.log('[vision] using OpenAI gpt-4o (no DO key set)')
  } else {
    // MIMO gateway fallback (supports vision)
    baseUrl = cfg.baseUrl
    apiKey = cfg.apiKey ?? ''
    model = 'mimo-v2.5'
    console.log('[vision] fallback to MIMO gateway (set CHATBAI_API_KEY or DO_INFERENCE_KEY for better vision)')
  }

  const userPrompt = `${productContext ? `Context about our product catalogue:\n${productContext}\n\n` : ''}Analyze this image and return a JSON object with these fields:
- color (string, optional): dominant color(s) of the item
- pattern (string, optional): pattern or print (e.g. solid, striped, floral)
- fabric (string, optional): fabric type if discernible (e.g. cotton, denim, silk)
- style (string, optional): style descriptor (e.g. casual, formal, sporty)
- fit (string, optional): fit type (e.g. slim, loose, oversized)
- category (string, optional): product category (e.g. dress, shirt, pants, bag, shoes)
- keywords (string[]): 3-8 search keywords to match this item in a product catalogue
- summary (string): one sentence describing what is visible in the image

Return ONLY valid JSON, no markdown, no explanation.`
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      // Multi-modal content — typed as any to satisfy the ChatMessage string constraint
      // while still sending the image_url block the API expects.
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ] as any,
    },
  ]

  const body = {
    model,
    messages,
    max_tokens: 512,
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.warn(`[vision] primary failed (${res.status}), trying Bytez fallback`)

    // ── Bytez fallback (best-effort, 5s timeout) ─────────────────────────
    try {
      const { bytezAnalyzeImage } = await import('./bytez.server')
      const prompt = `Analyze this product image and return a JSON object with fields: color, pattern, fabric, style, fit, category, keywords (array of 3-8 strings), summary. Return ONLY valid JSON.`
      const raw = await Promise.race([
        bytezAnalyzeImage(imageUrl, prompt),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Bytez fallback timed out')), 8_000)
        ),
      ])
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      try {
        const parsed = JSON.parse(cleaned) as Partial<VisionAnalysis>
        console.log('[vision] used Bytez fallback successfully')
        return {
          color: parsed.color,
          pattern: parsed.pattern,
          fabric: parsed.fabric,
          style: parsed.style,
          fit: parsed.fit,
          category: parsed.category,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          summary: parsed.summary ?? 'Image analyzed via Bytez.',
        }
      } catch {
        return { keywords: [], summary: raw.slice(0, 200) || 'Image analyzed via Bytez.' }
      }
    } catch (bytezErr: any) {
      console.warn('[vision] Bytez fallback unavailable:', bytezErr.message)
      // Bytez account has empty catalog — return a graceful fallback
      // instead of crashing the whole image pipeline.
      return {
        keywords: [],
        summary: 'Image received but vision analysis temporarily unavailable.',
      }
    }
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = json.choices?.[0]?.message?.content?.trim() ?? ''

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<VisionAnalysis>
    return {
      color: parsed.color,
      pattern: parsed.pattern,
      fabric: parsed.fabric,
      style: parsed.style,
      fit: parsed.fit,
      category: parsed.category,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      summary: parsed.summary ?? 'Image analyzed.',
    }
  } catch {
    return {
      keywords: [],
      summary: raw.slice(0, 200) || 'Image could not be analyzed.',
    }
  }
}
