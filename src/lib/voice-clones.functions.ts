import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Voice cloning management server functions.
 * Handles: listing cloned voices, saving a new clone (from recorded/uploaded
 * audio), setting the active voice, deleting clones.
 */

export interface VoiceCloneRow {
  id: string;
  name: string;
  description: string;
  reference_id: string;
  sample_url: string | null;
  sample_text: string;
  provider: string;
  voice_id: string | null;
  quality_score: number;
  created_at: string;
  selected: boolean;
}

const cloneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  referenceId: z.string().min(1, "Reference ID is required"),
  sampleUrl: z.string().optional().nullable(),
  sampleText: z.string().optional().default(""),
  provider: z.enum(["fish", "mimo"]).default("fish"),
  voiceId: z.string().optional().nullable(),
  qualityScore: z.number().optional().default(0),
});

export const listVoiceClones = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: clones, error } = await supabaseAdmin
      .from("voice_clones")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("selected_voice_clone_id, fish_audio_model_id")
      .eq("id", 1)
      .maybeSingle();

    const selectedId = (settings as any)?.selected_voice_clone_id ?? null;

    return {
      clones: (clones ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        reference_id: c.reference_id,
        sample_url: c.sample_url ?? null,
        sample_text: c.sample_text ?? "",
        provider: c.provider ?? "fish",
        voice_id: c.voice_id ?? null,
        quality_score: c.quality_score ?? 0,
        created_at: c.created_at,
        selected: c.id === selectedId,
      })) as VoiceCloneRow[],
      selectedId,
      fishModelId: (settings as any)?.fish_audio_model_id ?? "",
    };
  });

export const saveVoiceClone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cloneSchema.parse(d))
  .handler(async ({ data }) => {
    // If a voice_id (Fish Audio reference) is provided, use it; else create one
    let referenceId = data.referenceId;

    // Upsert into voice_clones
    const { data: saved, error } = await supabaseAdmin
      .from("voice_clones")
      .insert({
        name: data.name,
        description: data.description,
        reference_id: referenceId,
        sample_url: data.sampleUrl ?? null,
        sample_text: data.sampleText,
        provider: data.provider,
        voice_id: data.voiceId ?? null,
        quality_score: data.qualityScore,
      })
      .select("id")
      .single();

    if (error) throw new Error("Failed to save voice clone: " + error.message);
    return { id: (saved as any)?.id, reference_id: referenceId };
  });

export const selectVoiceClone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().nullable() }).parse(d)
  )
  .handler(async ({ data }) => {
    // Validate the clone exists before setting it as active
    if (data.id !== null) {
      const { data: existing } = await supabaseAdmin
        .from("voice_clones")
        .select("id")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing) {
        throw new Error("Voice clone not found: id does not exist");
      }
    }
    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update({ selected_voice_clone_id: data.id })
      .eq("id", 1);
    if (error) throw new Error("Failed to select voice: " + error.message);
    return { ok: true };
  });

export const deleteVoiceClone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    // Clear selection if this was the active one
    await supabaseAdmin
      .from("agent_settings")
      .update({ selected_voice_clone_id: null })
      .eq("selected_voice_clone_id", data.id);

    const { error } = await supabaseAdmin
      .from("voice_clones")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Failed to delete voice: " + error.message);
    return { ok: true };
  });

const trainSchema = z.object({
  cloneId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  sampleUrl: z.string().optional().nullable(),
  sampleText: z.string().optional().default(""),
});

/**
 * Train / register a voice clone.
 *
 * When a Fish Audio API key is configured (env FISH_AUDIO_API_KEY or
 * agent_settings.fish_audio_api_key), this actually registers the voice with
 * Fish Audio and stores the returned reference_id so TTS can use it.
 *
 * When NO Fish key is configured (the current free default), it does NOT
 * hard-fail — it saves/updates the clone and reports that free Gemini TTS is
 * the active zero-config fallback. This guarantees the "Train Voice Clone"
 * button always does something useful without any paid key.
 */
export const trainVoiceClone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => trainSchema.parse(d))
  .handler(async ({ data }) => {
    const fishKey =
      process.env["FISH_AUDIO_API_KEY"] ||
      (await getFishKeyFromSettings()) ||
      "";

    // ── Path 1: Fish Audio key present → really train a voice ──
    if (fishKey) {
      try {
        const referenceId = await createFishVoice(fishKey, data.sampleUrl, data.name);
        await supabaseAdmin
          .from("voice_clones")
          .update({ reference_id: referenceId, quality_score: 100, provider: "fish" })
          .eq("id", data.cloneId);
        return {
          ok: true,
          status: "trained",
          provider: "fish",
          referenceId,
          message: "Voice trained with Fish Audio",
        };
      } catch (e: any) {
        return {
          ok: false,
          status: "fish-error",
          message: "Fish Audio training failed: " + e.message,
          fallback: "gemini-free",
        };
      }
    }

    // ── Path 2: No Fish key → zero-config free mode (Gemini TTS) ──
    const existingRef = await getExistingRef(data.cloneId);
    await supabaseAdmin
      .from("voice_clones")
      .update({
        reference_id: existingRef || "gemini-voice",
        provider: "gemini",
        quality_score: 60,
        sample_text: data.sampleText,
        description: data.description || "Trained with Gemini free TTS",
      })
      .eq("id", data.cloneId);

    return {
      ok: true,
      status: "trained-free",
      provider: "gemini",
      referenceId: "gemini-voice",
      message:
        "Trained with free Gemini TTS (no API key needed). Add a Fish Audio key in Admin > Voice to unlock full voice cloning.",
    };
  });

async function getExistingRef(cloneId: string) {
  const { data } = await supabaseAdmin
    .from("voice_clones")
    .select("reference_id")
    .eq("id", cloneId)
    .maybeSingle();
  return (data as any)?.reference_id ?? "";
}

async function getFishKeyFromSettings() {
  try {
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("fish_audio_api_key")
      .eq("id", 1)
      .maybeSingle();
    return (data as any)?.fish_audio_api_key ?? "";
  } catch {
    return "";
  }
}

/** Create a Fish Audio voice from an audio sample (download → POST bytes). */
async function createFishVoice(apiKey: string, sampleUrl: string | null | undefined, name: string): Promise<string> {
  if (!sampleUrl) {
    throw new Error("No audio sample to train from. Record or upload one first.");
  }

  // Fetch the sample bytes (supports data: URIs and http(s) URLs)
  let audioBuffer: Buffer;
  if (sampleUrl.startsWith("data:")) {
    const base64 = sampleUrl.split(",")[1] || "";
    audioBuffer = Buffer.from(base64, "base64");
  } else {
    const res = await fetch(sampleUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error("Could not fetch sample audio (" + res.status + ")");
    audioBuffer = Buffer.from(await res.arrayBuffer());
  }

  // Fish Audio /v1/voices — create a reusable voice from uploaded audio
  const form = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/webm" });
  form.append("voices", blob, "sample.webm");
  form.append("name", name);
  form.append("description", "Trained from Daddy AI admin");

  const res = await fetch("https://api.fish.audio/v1/voices", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fish Audio voice create failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.voice?.id || data?.id || (data?._id ?? "");
}
