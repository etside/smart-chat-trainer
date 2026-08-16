const GATEWAY = "https://ai.gateway.lovable.dev/v1";

async function getApiKey(override?: string | null) {
  if (override) return override;
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured (missing key).");
  return key;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(
  messages: ChatMessage[],
  model = "openai/gpt-5.6-sol",
  apiKeyOverride?: string | null,
): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": await getApiKey(apiKeyOverride),
    },
    body: JSON.stringify({ model, messages, reasoning_effort: "none" }),
  });

  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("NO_CREDITS");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
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
  form.append("model", "openai/gpt-4o-transcribe");
  form.append("prompt", "ট্রান্সক্রিপ্টটি বাংলা বা বাংলিশে হতে পারে। দয়া করে সঠিক বানান ও যতিচিহ্ন বজায় রাখুন। (The transcript may be in Bengali or Banglish. Please maintain correct spelling and punctuation.)");

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { "Lovable-API-Key": await getApiKey(apiKeyOverride) },
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
