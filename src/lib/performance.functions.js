import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getPerformanceStats = createServerFn({ method: "GET" })
    .middleware([ /* requireSupabaseAuth - adding later in route */])
    .handler(async ({ context }) => {
    const ctx = context;
    // Note: requireSupabaseAuth should be added in the final version
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: metrics } = await supabaseAdmin
        .from("performance_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
    const { data: settings } = await supabaseAdmin
        .from("agent_settings")
        .select("max_simultaneous_replies, enable_streaming")
        .eq("id", 1)
        .single();
    return {
        metrics: metrics || [],
        settings: settings || { max_simultaneous_replies: 5, enable_streaming: true }
    };
});
export const updatePerformanceSettings = createServerFn({ method: "POST" })
    .inputValidator((d) => z.object({
    max_simultaneous_replies: z.number().int().min(1).max(50),
    enable_streaming: z.boolean()
}).parse(d))
    .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
        .from("agent_settings")
        .update({
        max_simultaneous_replies: data.max_simultaneous_replies,
        enable_streaming: data.enable_streaming
    })
        .eq("id", 1);
    return { ok: true };
});
export async function logPerformanceMetric(action, durationMs, requestId, metadata = {}) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("performance_metrics").insert({
        action,
        duration_ms: durationMs,
        request_id: requestId || crypto.randomUUID(),
        metadata
    });
}
