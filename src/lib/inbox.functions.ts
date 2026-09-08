import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMetaMessage } from "@/lib/meta-sender.server";
import { fetchSenderName } from "@/lib/meta-sender.server";
import { logReplyPerformance } from "@/lib/analytics.server";

/**
 * List conversation sessions with filters
 */
// NOTE: these read fns use POST (not GET) — TanStack Start GET server fns
// serialize args via the `?d=` query param, which was arriving as undefined
// on the server (zod "Required"), leaving the admin inbox blank. POST body
// args are reliable and proven through the full middleware chain.
export const listSessions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["all", "active", "resolved", "escalated", "archived"]).default("all"),
        channel: z.string().optional(),
        search: z.string().optional(),
        page: z.number().int().min(0).default(0),
      })
      .parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const size = 25;
    let q = supabaseAdmin
      .from("conversation_sessions")
      .select("id, external_id, channel, customer_name, status, assigned_agent, message_count, started_at, last_message_at, priority_score, vip_flag", { count: "exact" })
      .order("last_message_at", { ascending: false })
      .range(data.page * size, data.page * size + size - 1);

    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.channel) q = q.eq("channel", data.channel);
    if (data.search?.trim()) {
      q = q.or(`customer_name.ilike.%${data.search.trim()}%,external_id.ilike.%${data.search.trim()}%`);
    }

    const { data: rows, count } = await q;
    const result = rows ?? [];

    // Backfill null customer_names fire-and-forget (non-blocking)
    const nullNameRows = result.filter((r: any) => !r.customer_name && r.external_id);
    if (nullNameRows.length > 0) {
      const { data: settings } = await supabaseAdmin
        .from('agent_settings').select('meta_access_token, meta_page_id').eq('id', 1).maybeSingle();
      const token = (settings as any)?.meta_access_token;
      const pageId = (settings as any)?.meta_page_id;
      if (token) {
        void (async () => {
          for (const row of nullNameRows.slice(0, 5)) { // max 5 per page load
            try {
              const name = await fetchSenderName(row.external_id, token, pageId);
              if (name) {
                await supabaseAdmin.from('conversation_sessions')
                  .update({ customer_name: name } as any)
                  .eq('id', row.id).is('customer_name', null);
              }
            } catch { /* non-fatal */ }
          }
        })();
      }
    }

    return { rows: result, total: count ?? 0, page: data.page, size };
  });

/**
 * Get messages for a session
 */
export const getSessionMessages = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { data: messages } = await supabaseAdmin
      .from("session_messages")
      .select("id, role, content, channel, metadata, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    return messages ?? [];
  });

/**
 * Send a draft reply to a customer via Meta API, then mark the message as sent
 */
export const sendDraftReply = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      messageId: z.string().uuid(),
      sessionId: z.string().uuid(),
      editedText: z.string().optional(),
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");

    // Get the message
    const { data: msg } = await supabaseAdmin
      .from("session_messages")
      .select("id, content, channel, session_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg) throw new Error("Message not found");

    // Get the session's external_id (recipient)
    const { data: session } = await supabaseAdmin
      .from("conversation_sessions")
      .select("external_id, channel")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session?.external_id) throw new Error("Session or recipient not found");

    const platform = (session.channel ?? msg.channel ?? "messenger") as "messenger" | "whatsapp" | "instagram";

    // Send via Meta API — use editedText if admin edited the draft
    const textToSend = data.editedText?.trim() || msg.content;
    await sendMetaMessage(session.external_id, textToSend, platform);

    // Mark as sent and record final text
    await supabaseAdmin
      .from("session_messages")
      .update({ metadata: { is_draft: false, sent: true }, content: textToSend })
      .eq("id", data.messageId);

    // Log as sent for continuous learning loop
    await logReplyPerformance(data.sessionId, null, "sent").catch(() => {});

    return { ok: true };
  });

/**
 * Assign a session to an agent
 */
export const assignSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), agent: z.string().min(1) }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    await supabaseAdmin
      .from("conversation_sessions")
      .update({ assigned_agent: data.agent })
      .eq("id", data.sessionId);
    return { ok: true };
  });

/**
 * Update session status
 */
export const updateSessionStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        status: z.enum(["active", "resolved", "escalated", "archived"]),
      })
      .parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    await supabaseAdmin
      .from("conversation_sessions")
      .update({ status: data.status })
      .eq("id", data.sessionId);
    return { ok: true };
  });


/**
 * Send a manual reply typed by admin directly via Meta API
 * and log it as a sent assistant message in session_messages
 */
export const sendManualReply = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      text: z.string().min(1).max(2000),
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");

    const { data: session } = await supabaseAdmin
      .from("conversation_sessions")
      .select("external_id, channel")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session?.external_id) throw new Error("Session not found");

    const platform = (session.channel ?? "messenger") as "messenger" | "whatsapp" | "instagram";
    await sendMetaMessage(session.external_id, data.text, platform);

    // Log the manual reply in session_messages
    await supabaseAdmin.from("session_messages").insert({
      session_id: data.sessionId,
      role: "assistant",
      content: data.text,
      channel: session.channel,
      metadata: { is_draft: false, sent: true, source: "manual_admin" },
    });

    // Update session last_message_at
    await supabaseAdmin
      .from("conversation_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.sessionId);

    await logReplyPerformance(data.sessionId, null, "sent").catch(() => {});
    return { ok: true };
  });

type AnalyticsSummary = {
  total_conversations: number;
  total_messages: number;
  channel_breakdown: Record<string, number>;
  top_questions: Array<{ question: string; count: number }>;
  avg_messages_per_conversation: number;
  response_accuracy: number;
};

/**
 * Get analytics summary
 */
export const getAnalyticsSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<AnalyticsSummary> => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { data: result } = await supabaseAdmin.rpc("get_analytics_summary", { _days: data.days });
    return (result as AnalyticsSummary[] | undefined)?.[0] ?? {
      total_conversations: 0,
      total_messages: 0,
      channel_breakdown: {},
      top_questions: [],
      avg_messages_per_conversation: 0,
      response_accuracy: 0,
    };
  });

/**
 * Get conversation volume over time
 */
export const getConversationVolume = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(90).default(30) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: sessions } = await supabaseAdmin
      .from("conversation_sessions")
      .select("started_at, channel")
      .gte("started_at", since)
      .order("started_at");

    // Group by date
    const byDate: Record<string, { total: number; channels: Record<string, number> }> = {};
    sessions?.forEach((s) => {
      const date = s.started_at?.slice(0, 10) ?? "unknown";
      if (!byDate[date]) byDate[date] = { total: 0, channels: {} };
      byDate[date].total++;
      const ch = s.channel ?? "unknown";
      byDate[date].channels[ch] = (byDate[date].channels[ch] || 0) + 1;
    });

    return Object.entries(byDate).map(([date, v]) => ({ date, ...v }));
  });

/**
 * Get channel distribution
 */
export const getChannelDistribution = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: sessions } = await supabaseAdmin
      .from("conversation_sessions")
      .select("channel")
      .gte("started_at", since);

    const counts: Record<string, number> = {};
    sessions?.forEach((s) => {
      const ch = s.channel ?? "unknown";
      counts[ch] = (counts[ch] || 0) + 1;
    });

    return Object.entries(counts).map(([channel, count]) => ({ channel, count }));
  });

/**
 * Send a voice reply from admin to customer via Meta API
 */
export const sendVoiceReply = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      audio: z.string().min(1), // base64 encoded audio
      mimeType: z.string().default("audio/webm"),
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");

    const { data: session } = await supabaseAdmin
      .from("conversation_sessions")
      .select("external_id, channel")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session?.external_id) throw new Error("Session not found");

    const platform = (session.channel ?? "messenger") as "messenger" | "whatsapp" | "instagram";
    const { sendVoiceMessage } = await import("@/lib/meta-sender.server");
    await sendVoiceMessage(session.external_id, data.audio, data.mimeType, platform);

    // Log the voice message in session_messages
    await supabaseAdmin.from("session_messages").insert({
      session_id: data.sessionId,
      role: "assistant",
      content: "[Voice message]",
      channel: session.channel,
      metadata: {
        is_draft: false,
        sent: true,
        source: "manual_voice",
        attachment_type: "audio",
      },
    });

    // Update session last_message_at
    await supabaseAdmin
      .from("conversation_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.sessionId);

    await logReplyPerformance(data.sessionId, null, "sent").catch(() => {});
    return { ok: true };
  });
