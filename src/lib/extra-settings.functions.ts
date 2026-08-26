import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

/** Public subset — no auth required, called from __root.tsx on every page load */
export const getExtraSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("reduce_motion")
      .eq("id", 1)
      .maybeSingle();

    return {
      reduceMotion: (data as any)?.reduce_motion ?? false,
    };
  });

/** Admin-only full settings — requires auth */
export const getExtraSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const row = data as any;
    return {
      reduceMotion: row?.reduce_motion ?? false,
      b2bBackblazeKey: row?.b2b_backblaze_key ? "••••••••" : "",
      bosonWorkspaceId: row?.boson_workspace_id || "",
      fishAudioApiKey: row?.fish_audio_api_key ? "••••••••" : "",
      fishAudioModelId: row?.fish_audio_model_id || "",
      voiceProvider: row?.voice_provider || "fish",
      altApiKeys: row?.alt_api_keys || {},
      vpsHostingConfig: row?.vps_hosting_config || {}
    };
  });

export const updateExtraSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => 
    z.object({
      reduceMotion: z.boolean().optional(),
      b2bBackblazeKey: z.string().optional(),
      bosonWorkspaceId: z.string().optional(),
      fishAudioApiKey: z.string().optional(),
      fishAudioModelId: z.string().optional(),
      voiceProvider: z.enum(["fish", "mimo"]).optional(),
      altApiKeys: z.record(z.string()).optional(),
      vpsHostingConfig: z.record(z.any()).optional(),
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const updateData: any = {};
    if (data.reduceMotion !== undefined) updateData.reduce_motion = data.reduceMotion;
    if (data.b2bBackblazeKey !== undefined && data.b2bBackblazeKey !== "••••••••") updateData.b2b_backblaze_key = data.b2bBackblazeKey;
    if (data.bosonWorkspaceId !== undefined) updateData.boson_workspace_id = data.bosonWorkspaceId;
    if (data.fishAudioApiKey !== undefined && data.fishAudioApiKey !== "••••••••") updateData.fish_audio_api_key = data.fishAudioApiKey;
    if (data.fishAudioModelId !== undefined) updateData.fish_audio_model_id = data.fishAudioModelId;
    if (data.voiceProvider !== undefined) updateData.voice_provider = data.voiceProvider;
    if (data.altApiKeys !== undefined) updateData.alt_api_keys = data.altApiKeys;
    if (data.vpsHostingConfig !== undefined) updateData.vps_hosting_config = data.vpsHostingConfig;

    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update(updateData)
      .eq("id", 1);
      
    if (error) throw new Error(error.message);
    return { ok: true };
  });
