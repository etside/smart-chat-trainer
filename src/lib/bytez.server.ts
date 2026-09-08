'use server'
/**
 * bytez.server.ts
 * Unified Bytez AI provider — https://docs.bytez.com
 *
 * Covers: Vision (image-text-to-text), ASR (automatic-speech-recognition),
 *         TTS (text-to-speech), Text/Chat (chat completions)
 *
 * API key: stored in agent_settings.bytez_api_key
 *          or env BYTEZ_API_KEY
 */

const BYTEZ_BASE = 'https://api.bytez.com'

// ── Models used by task ────────────────────────────────────────────────────
const BYTEZ_MODELS = {
  // Vision: image-text-to-text — Gemma 3 4B multimodal
  vision: 'qwen3.8-flash',
  // ASR: automatic-speech-recognition
  asr: 'facebook/data2vec-audio-base-960h',
  // TTS: text-to-speech — Bark (multilingual)
  tts: 'suno/bark-small',
  // Text/chat: uses OAI-compatible endpoint
  chat: 'qwen3.8-flash',
  // STS (speech-to-speech): use ASR → TTS chain (Bytez has no direct STS)
} as const

// ── Key resolution — cached per process ────────────────────────────────────
let _bytezKeyCache: string | null | undefined = undefined

export async function getBytezKey(): Promise<string | null> {
  if (_bytezKeyCache !== undefined) return _bytezKeyCache

  const envKey = process.env['BYTEZ_API_KEY']
  if (envKey) { _bytezKeyCache = envKey; return envKey }

  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('agent_settings')
      .select('bytez_api_key')
      .eq('id', 1)
      .maybeSingle()
    const key = (data as any)?.bytez_api_key ?? null
    _bytezKeyCache = key
    return key
  } catch {
    _bytezKeyCache = null
    return null
  }
}

/** Clear the cached key (call after settings update) */
export function clearBytezKeyCache() {
  _bytezKeyCache = undefined
}

// ── Core fetch helper ──────────────────────────────────────────────────────
async function bytezPost(path: string, body: Record<string, unknown>): Promise<any> {
  const key = await getBytezKey()
  if (!key) throw new Error('[Bytez] No API key configured — add bytez_api_key in Settings')

  const res = await fetch(`${BYTEZ_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: key,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[Bytez] ${path} failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const json = await res.json()
  if (json.error) throw new Error(`[Bytez] ${path} error: ${json.error}`)
  return json.output
}

// ── Vision — image-text-to-text ────────────────────────────────────────────
/**
 * Analyze an image URL and return a text description.
 * Uses google/gemma-3-4b-it (multimodal, image-text-to-text).
 */
export async function bytezAnalyzeImage(
  imageUrl: string,
  prompt: string,
): Promise<string> {
  const output = await bytezPost(`/models/v2/${BYTEZ_MODELS.vision}`, {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', url: imageUrl },
        ],
      },
    ],
    params: { max_length: 512, temperature: 0.3 },
  })
  // output is { role, content } or a string
  if (typeof output === 'string') return output
  return (output?.content ?? output?.text ?? JSON.stringify(output)).trim()
}

// ── ASR — automatic-speech-recognition ────────────────────────────────────
/**
 * Transcribe audio to text.
 * Accepts either a public URL or base64 (data:audio/wav;base64,...).
 */
export async function bytezTranscribe(
  audioInput: { url?: string; base64?: string },
): Promise<string> {
  if (!audioInput.url && !audioInput.base64) {
    throw new Error('[Bytez] transcribe requires url or base64')
  }

  const body: Record<string, string> = audioInput.url
    ? { url: audioInput.url }
    : { base64: audioInput.base64! }

  const output = await bytezPost(`/models/v2/${BYTEZ_MODELS.asr}`, body)
  if (typeof output === 'string') return output
  return (output?.text ?? JSON.stringify(output)).trim()
}

// ── TTS — text-to-speech ──────────────────────────────────────────────────
/**
 * Convert text to speech.
 * Returns a base64 mp3 string (fetches the audio URL Bytez returns).
 */
export async function bytezTTS(text: string): Promise<{ audio: string; mimeType: string }> {
  // Bytez TTS returns a URL to the generated audio
  const audioUrl = await bytezPost(`/models/v2/${BYTEZ_MODELS.tts}`, { text })

  if (typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) {
    throw new Error(`[Bytez] TTS returned unexpected output: ${JSON.stringify(audioUrl)}`)
  }

  // Fetch the audio and convert to base64
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new Error(`[Bytez] Could not fetch TTS audio: ${audioRes.status}`)
  const buffer = await audioRes.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return { audio: base64, mimeType: 'audio/wav' }
}

// ── STS — speech-to-speech (ASR → TTS chain) ─────────────────────────────
/**
 * Speech-to-speech: transcribe input audio → generate response text → TTS.
 * Used when the customer sends a voice message and we reply with audio.
 */
export async function bytezSTS(
  audioInput: { url?: string; base64?: string },
  generateReply: (transcript: string) => Promise<string>,
): Promise<{ transcript: string; replyText: string; audio: string; mimeType: string }> {
  // 1. Transcribe
  const transcript = await bytezTranscribe(audioInput)

  // 2. Generate reply text
  const replyText = await generateReply(transcript)

  // 3. TTS
  const { audio, mimeType } = await bytezTTS(replyText)

  return { transcript, replyText, audio, mimeType }
}

// ── Chat/Text — OAI-compatible via Bytez ──────────────────────────────────
/**
 * Chat completion using Bytez open-source models.
 * Uses OAI-compatible endpoint at /models/v2/{model}/chat/completions.
 */
export async function bytezChat(
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const key = await getBytezKey()
  if (!key) throw new Error('[Bytez] No API key configured')

  const res = await fetch(`${BYTEZ_BASE}/models/v2/${BYTEZ_MODELS.chat}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: key,
    },
    body: JSON.stringify({
      messages,
      params: {
        max_length: options.maxTokens ?? 400,
        temperature: options.temperature ?? 0.7,
      },
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`[Bytez] chat failed (${res.status}): ${t.slice(0, 200)}`)
  }

  const json = await res.json()
  if (json.error) throw new Error(`[Bytez] chat error: ${json.error}`)

  const output = json.output
  if (typeof output === 'string') return output
  return (output?.content ?? output?.text ?? '').trim()
}
