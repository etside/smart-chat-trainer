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
      provider: z.enum(["fish", "mimo", "gemini"]).default("fish"),
      modelId: z.string().optional(),
      voiceId: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("fish_audio_api_key, ai_api_key_override, selected_voice_clone_id, fish_audio_model_id")
      .eq("id", 1)
      .maybeSingle();

    // Resolve voice reference: explicit voiceId > selected clone > modelId > default
    let resolvedVoiceId = data.voiceId || data.modelId;
    if (!resolvedVoiceId && (settings as any)?.selected_voice_clone_id) {
      const { data: clone } = await supabaseAdmin
        .from("voice_clones")
        .select("reference_id, voice_id")
        .eq("id", (settings as any)?.selected_voice_clone_id)
        .maybeSingle();
      resolvedVoiceId = (clone as any)?.reference_id || (clone as any)?.voice_id || resolvedVoiceId;
    }
    if (!resolvedVoiceId) resolvedVoiceId = (settings as any)?.fish_audio_model_id || undefined;

    if (data.provider === "gemini") {
      return await geminiTTS(data.text);
    } else if (data.provider === "mimo") {
      return await mimoTTS(data.text, resolvedVoiceId, (settings as any)?.ai_api_key_override);
    } else {
      try {
        return await fishTTS(data.text, resolvedVoiceId, (settings as any)?.fish_audio_api_key);
      } catch (fishErr: any) {
        // Bytez TTS fallback when Fish Audio fails or key not set
        console.warn('[tts] Fish Audio failed, trying Bytez fallback:', fishErr.message);
        try {
          const { bytezTTS } = await import('./bytez.server');
          const { audio, mimeType } = await bytezTTS(data.text);
          console.log('[tts] used Bytez fallback');
          return { audio, mimeType, format: 'wav', provider: 'bytez' };
        } catch (bytezErr: any) {
          console.error('[tts] Bytez fallback also failed:', bytezErr.message);
          throw fishErr; // re-throw original
        }
      }
    }
  });

async function geminiTTS(text: string, voiceName?: string) {
  const apiKey = process.env["GEMINI_API_KEY"] || "";

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in environment.");
  }

  // Gemini TTS via generateContent with AUDIO response modality (PCM 24kHz)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || "Kore" },
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini TTS failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p: any) => p.inlineData?.data);
  if (!inline) {
    throw new Error(`Gemini TTS returned no audio: ${JSON.stringify(data).slice(0, 300)}`);
  }

  // Gemini returns PCM (audio/L16) — convert to WAV so browsers can play it
  const pcm = Buffer.from(inline.inlineData.data, "base64");
  const wav = pcmToWav(pcm, 24000);

  return { audio: wav.toString("base64"), mimeType: "audio/wav", format: "wav", provider: "gemini" };
}

/** Convert raw 16-bit PCM to a WAV container (browsers can't play bare PCM). */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);
  return buffer;
}

async function fishTTS(text: string, referenceId?: string, apiKey?: string) {
  if (!apiKey) {
    apiKey = process.env["FISH_AUDIO_API_KEY"] || "";
  }
  if (!apiKey) {
    throw new Error("Fish Audio API key not configured. Set FISH_AUDIO_API_KEY in environment or Admin > Settings.");
  }

  const body: Record<string, any> = {
    text,
    format: "mp3",
    latency: "normal",
    normalize: true,
  };

  // Use cloned voice if reference_id is set and not default
  if (referenceId && referenceId !== "default" && referenceId.length > 10) {
    body.reference_id = referenceId;
  }

  const res = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "model": "s2-pro",  // Fish Audio S2 Pro — best quality
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 402) {
    throw new Error("Fish Audio: insufficient API credits. Visit https://fish.audio/app/developers to add credits.");
  }
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
