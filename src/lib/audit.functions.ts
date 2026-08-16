import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

export const getAuditLogs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      page: z.number().int().min(0).default(0),
      action: z.string().optional(),
    }).parse(d || {})
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const size = 20;
    let q = supabaseAdmin
      .from("audit_logs")
      .select("*, actor:actor_id(id, email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * size, data.page * size + size - 1);

    if (data.action) q = q.eq("action", data.action);

    const { data: rows, count } = await q;
    return { rows: rows ?? [], total: count ?? 0, page: data.page, size };
  });

export const rotateSyncCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey } = await import("./admin.server");

    const newSyncToken = generateApiKey().replace('wi_', 'sync_');
    const newSyncSecret = generateApiKey().replace('wi_', 'sec_');

    // Store old for rollback possibility (metadata)
    const { data: old } = await supabaseAdmin.from("agent_settings").select("sync_token, sync_secret").eq("id", 1).single();

    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update({
        sync_token: newSyncToken,
        sync_secret: newSyncSecret,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (error) throw error;

    // Log audit
    await supabaseAdmin.rpc('log_audit', {
      _actor_id: context.userId,
      _action: 'rotate_sync_credentials',
      _entity_type: 'agent_settings',
      _entity_id: undefined,
      _metadata: { old_token_prefix: old?.sync_token?.slice(0, 8) }
    });

    return { token: newSyncToken, secret: newSyncSecret };
  });

export const rollbackSyncCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), secret: z.string() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update({
        sync_token: data.token,
        sync_secret: data.secret,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (error) throw error;

    await supabaseAdmin.rpc('log_audit', {
      _actor_id: context.userId,
      _action: 'rollback_sync_credentials',
      _entity_type: 'agent_settings',
      _entity_id: null,
      _metadata: { rolled_back_to_prefix: data.token.slice(0, 8) }
    });

    return { ok: true };
  });
