const GATEWAY = process.env["AI_GATEWAY_URL"] || "https://api.xiaomimimo.com/v1";
const DEFAULT_API_KEY = process.env["MIMO_API_KEY"] || "";

async function getApiKey(override?: string | null) {
  if (override) return override;
  if (DEFAULT_API_KEY) return DEFAULT_API_KEY;
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured (missing key).");
  return key;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(
  messages: ChatMessage[],
  model = "mimo-v2.5",
  apiKeyOverride?: string | null,
  stream = false
): Promise<string | ReadableStream> {
  const body = { 
    model, 
    messages, 
    stream
  };

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${await getApiKey(apiKeyOverride)}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("NO_CREDITS");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  if (stream && res.body) {
    return res.body;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function transcribeAudio(
  base64Audio: string,
  mimeType: string,
  apiKeyOverride?: string | null,
): Promise<string> {
  const binary = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
  const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";
  const form = new FormData();
  form.append("file", new Blob([binary], { type: mimeType }), `audio.${ext}`);
  form.append("model", "openai/whisper-large-v3-turbo");
  form.append("prompt", "ট্রান্সক্রিপ্টটি দ্রুত ও নির্ভুলভাবে বাংলা বা বাংলিশে করুন। (Transcribe quickly and accurately in Bengali or Banglish.)");

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${await getApiKey(apiKeyOverride)}` },
    body: form,
  });

  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("NO_CREDITS");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcription failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
