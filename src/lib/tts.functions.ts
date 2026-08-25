import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Text-to-Speech using Fish Audio or MiMo (Xiaomi) TTS API.
 * Returns base64-encoded audio data.
 */
export const textToSpeech = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      text: z.string().min(1).max(5000),
      provider: z.enum(["fish", "mimo"]).default("fish"),
      modelId: z.string().optional(),
      voiceId: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("fish_audio_api_key, ai_api_key_override")
      .eq("id", 1)
      .maybeSingle();

    if (data.provider === "mimo") {
      return await mimoTTS(data.text, data.voiceId, (settings as any)?.ai_api_key_override);
    } else {
      return await fishTTS(data.text, data.modelId, (settings as any)?.fish_audio_api_key);
    }
  });

async function fishTTS(text: string, modelId?: string, apiKey?: string) {
  if (!apiKey) {
    throw new Error("Fish Audio API key not configured. Add it in Settings > B2B & External Services.");
  }

  const res = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text,
      reference_id: modelId && modelId !== "default" ? modelId : undefined,
      format: "mp3",
      latency: "normal",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fish Audio TTS failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const audioBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString("base64");

  return { audio: base64, mimeType: "audio/mpeg", format: "mp3", provider: "fish" };
}

async function mimoTTS(text: string, voiceId?: string, apiKeyOverride?: string) {
  const GATEWAY = process.env["AI_GATEWAY_URL"] || "https://api.xiaomimimo.com/v1";
  const apiKey = apiKeyOverride || process.env["MIMO_API_KEY"] || "";

  if (!apiKey) {
    throw new Error("MiMo API key not configured. Set MIMO_API_KEY in environment.");
  }

  // MiMo TTS endpoint
  const res = await fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mimo-tts-1",
      input: text,
      voice: voiceId || "alloy",
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiMo TTS failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const audioBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString("base64");

  return { audio: base64, mimeType: "audio/mpeg", format: "mp3", provider: "mimo" };
}
