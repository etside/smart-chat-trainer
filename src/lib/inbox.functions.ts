import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * List conversation sessions with filters
 */
export const listSessions = createServerFn({ method: "GET" })
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
      .select("id, external_id, channel, customer_name, status, assigned_agent, message_count, started_at, last_message_at", { count: "exact" })
      .order("last_message_at", { ascending: false })
      .range(data.page * size, data.page * size + size - 1);

    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.channel) q = q.eq("channel", data.channel);
    if (data.search?.trim()) {
      q = q.or(`customer_name.ilike.%${data.search.trim()}%,external_id.ilike.%${data.search.trim()}%`);
    }

    const { data: rows, count } = await q;
    return { rows: rows ?? [], total: count ?? 0, page: data.page, size };
  });

/**
 * Get messages for a session
 */
export const getSessionMessages = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { data: messages } = await supabaseAdmin
      .from("session_messages")
      .select("id, role, content, channel, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    return messages ?? [];
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
export const getAnalyticsSummary = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<AnalyticsSummary> => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { data: result } = await supabaseAdmin.rpc("get_analytics_summary", { _days: data.days });
    return (result?.[0] as AnalyticsSummary) ?? {
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
export const getConversationVolume = createServerFn({ method: "GET" })
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
export const getChannelDistribution = createServerFn({ method: "GET" })
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
