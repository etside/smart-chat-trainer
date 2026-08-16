import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

export const getUsageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    await assertAdmin(ctx.supabase, ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get aggregated stats
    const { data: stats, error } = await supabaseAdmin.rpc("get_usage_aggregates" as any);
    if (error) throw error;

    // Get recent logs
    const { data: logs } = await supabaseAdmin
      .from("usage_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // Get config
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("usage_config")
      .eq("id", 1)
      .single();

    return {
      stats: (stats as any) || { total_credits: 0, total_usd: 0, total_bdt: 0 },
      logs: logs || [],
      config: (settings?.usage_config as any) || {}
    };
  });

export const getUsageAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    await assertAdmin(ctx.supabase, ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("usage_alerts").select("*").order("created_at", { ascending: false });
    return data || [];
  });

export const saveUsageAlert = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    threshold_credits: z.number().int(),
    threshold_usd: z.number(),
    threshold_bdt: z.number(),
    type: z.enum(['daily', 'monthly']),
    is_active: z.boolean().default(true)
  }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const ctx = context as any;
    await assertAdmin(ctx.supabase, ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const payload = {
      threshold_credits: data.threshold_credits,
      threshold_usd: data.threshold_usd,
      threshold_bdt: data.threshold_bdt,
      type: data.type,
      is_active: data.is_active
    };

    if (data.id) {
      await supabaseAdmin.from("usage_alerts").update(payload).eq("id", data.id);
    } else {
      await supabaseAdmin.from("usage_alerts").insert(payload);
    }
    return { ok: true };

  });

export const deleteUsageAlert = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const ctx = context as any;
    await assertAdmin(ctx.supabase, ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("usage_alerts").delete().eq("id", data.id);
    return { ok: true };
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    await assertAdmin(ctx.supabase, ctx.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("notification_logs").select("*").order("created_at", { ascending: false }).limit(20);
    return data || [];
  });


export const logActionUsage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    action: z.string(),
    metadata: z.any().optional()
  }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as any;
    // This is typically called from other server functions
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Get rates
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("usage_config")
      .eq("id", 1)
      .single();
    
    const config = (settings?.usage_config as any)?.[data.action] || { credits: 0, usd: 0, bdt: 0 };

    const { error } = await supabaseAdmin.from("usage_logs").insert({
      actor_id: ctx?.userId || null,
      action: data.action,
      credits_used: config.credits,
      cost_usd: config.usd,
      cost_bdt: config.bdt,
      metadata: data.metadata || {}
    });

    if (error) throw error;
    
    // Update total credits in agent_settings (demo purposes, real app might track per user)
    await supabaseAdmin.rpc('increment_agent_credits' as any, { amount: config.credits });


    // Trigger threshold check
    await supabaseAdmin.rpc('check_usage_thresholds');

    return { ok: true };
  });
