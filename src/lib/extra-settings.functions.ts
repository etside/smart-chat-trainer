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
      vpsHostingConfig: row?.vps_hosting_config || {},
      autoReplyMode: row?.auto_reply_mode || 'off',
      adminPin: row?.admin_pin || '856777',
      pinEnabled: row?.pin_enabled !== false,
      bytezApiKey: row?.bytez_api_key ? '••••••••' : '',
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
      voiceProvider: z.enum(["fish", "mimo", "gemini"]).optional(),
      altApiKeys: z.record(z.string()).optional(),
      vpsHostingConfig: z.record(z.any()).optional(),
      autoReplyMode: z.enum(["on", "off", "standby"]).optional(),
      adminPin: z.string().length(6).regex(/^\d{6}$/).optional(),
      pinEnabled: z.boolean().optional(),
      bytezApiKey: z.string().optional(),
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
    if (data.adminPin !== undefined) updateData.admin_pin = data.adminPin;
    if (data.pinEnabled !== undefined) updateData.pin_enabled = data.pinEnabled;
    if (data.autoReplyMode !== undefined) updateData.auto_reply_mode = data.autoReplyMode;
    if (data.bytezApiKey !== undefined && data.bytezApiKey !== '••••••••') {
      updateData.bytez_api_key = data.bytezApiKey;
      // Clear both Bytez and AI config caches so next request picks up new keys
      const { clearBytezKeyCache } = await import('./bytez.server');
      const { clearAiConfigCache } = await import('./ai.server');
      clearBytezKeyCache();
      clearAiConfigCache();
    }

    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update(updateData)
      .eq("id", 1);
      
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Draft Reply Management ──────────────────────────────────────────────────

/** Get pending draft replies (admin only) */
export const getPendingDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("webhook_logs")
      .select("id, payload, created_at, source")
      .eq("processing_status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      message: row.payload?.message || "",
      draft_reply: row.payload?.draft_reply || "",
      sender: row.payload?.sender || row.payload?.from || "",
      conversation_id: row.payload?.conversation_id || "",
      created_at: row.created_at,
    }));
  });

/** Approve and send a draft reply */
export const approveDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ logId: z.string().uuid() }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logConversation } = await import("@/lib/agent.server");

    const { data: log } = await supabaseAdmin
      .from("webhook_logs")
      .select("*")
      .eq("id", data.logId)
      .eq("processing_status", "pending_approval")
      .maybeSingle();

    if (!log) throw new Error("Draft not found or already processed");

    const payload = log.payload as any;
    const reply = payload?.draft_reply;
    if (!reply) throw new Error("No draft reply in this log entry");

    await logConversation(
      payload?.conversation_id || payload?.sender || null,
      "webhook",
      [
        { role: "user", content: payload?.message || "" },
        { role: "assistant", content: reply },
      ]
    );

    // Actually send the reply via Meta
    const platform = (payload?.platform || payload?.source || "messenger") as "messenger" | "whatsapp" | "instagram";
    const recipientId = payload?.sender || payload?.conversation_id;
    if (recipientId) {
      try {
        const { sendMetaMessage } = await import("@/lib/meta-sender.server");
        await sendMetaMessage(recipientId, reply, platform);
      } catch (sendErr: any) {
        console.error("[approveDraft] send failed:", sendErr?.message);
        throw new Error("Failed to send message: " + sendErr?.message);
      }
    }

    await supabaseAdmin
      .from("webhook_logs")
      .update({ processing_status: "success" })
      .eq("id", data.logId);

    return { ok: true, reply };
  });

/** Regenerate a draft reply (re-run AI and store new draft) */
export const regenerateDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ logId: z.string().uuid() }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateReply } = await import("@/lib/agent.server");

    const { data: log } = await supabaseAdmin
      .from("webhook_logs")
      .select("*")
      .eq("id", data.logId)
      .eq("processing_status", "pending_approval")
      .maybeSingle();

    if (!log) throw new Error("Draft not found or already processed");

    const payload = log.payload as any;
    const message = payload?.message;
    if (!message) throw new Error("No original message in this log entry");

    const { reply } = await generateReply(message, []);

    await supabaseAdmin
      .from("webhook_logs")
      .update({
        payload: { ...payload, draft_reply: reply },
      })
      .eq("id", data.logId);

    return { ok: true, reply };
  });

/** Dismiss (delete) a draft reply */
export const dismissDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ logId: z.string().uuid() }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("webhook_logs")
      .update({ processing_status: "dismissed" })
      .eq("id", data.logId)
      .eq("processing_status", "pending_approval");

    return { ok: true };
  });
