import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";

const PLATFORMS = ["messenger", "whatsapp", "instagram", "web"] as const;

function randomToken(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const body = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${body}`;
}

function newCredential(userId: string, platform: string) {
  return {
    user_id: userId,
    platform,
    client_token: randomToken(`${platform.slice(0, 2)}tok`),
    client_secret: randomToken(`${platform.slice(0, 2)}sec`),
    webhook_verify_token: randomToken("verify"),
    status: "active",
  };
}

/** Returns the signed-in tenant's platform credentials, provisioning them on first access (i.e. right after sign-up). */
export const getMyPlatformCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: existing } = await supabaseAdmin
      .from("tenant_credentials")
      .select("*")
      .eq("user_id", userId);

    const missing = PLATFORMS.filter((p) => !existing?.some((c: any) => c.platform === p));
    if (missing.length > 0) {
      await supabaseAdmin
        .from("tenant_credentials")
        .upsert(
          missing.map((p) => newCredential(userId, p)),
          { onConflict: "user_id,platform" },
        );
    }

    const { data } = await supabaseAdmin
      .from("tenant_credentials")
      .select("*")
      .eq("user_id", userId)
      .order("platform");

    return data ?? [];
  });

export const regeneratePlatformCredential = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ platform: z.enum(PLATFORMS) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fresh = {
      ...newCredential(context.userId, data.platform),
      rotated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabaseAdmin
      .from("tenant_credentials")
      .upsert(fresh, { onConflict: "user_id,platform" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "credential.rotate",
      entity_type: "tenant_credentials",
      entity_id: row.id,
      metadata: { platform: data.platform } as any,
    });

    return row;
  });

/** Admin-only: shared webhook + cron secrets used by external senders and schedulers. */
export const getDeliverySecrets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let { data } = await supabaseAdmin
      .from("agent_settings")
      .select("webhook_secret, cron_secret")
      .eq("id", 1)
      .maybeSingle();

    if (!data?.webhook_secret || !data?.cron_secret) {
      const patch = {
        webhook_secret: data?.webhook_secret ?? randomToken("whsec"),
        cron_secret: data?.cron_secret ?? randomToken("cron"),
      };
      await supabaseAdmin.from("agent_settings").update(patch).eq("id", 1);
      data = { ...(data ?? {}), ...patch };
    }

    return { webhook_secret: data.webhook_secret, cron_secret: data.cron_secret };
  });

export const rotateDeliverySecret = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["webhook", "cron"]) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const value = randomToken(data.kind === "webhook" ? "whsec" : "cron");
    const patch =
      data.kind === "webhook"
        ? { webhook_secret: value }
        : { cron_secret: value };
    await supabaseAdmin
      .from("agent_settings")
      .update(patch)
      .eq("id", 1);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "secret.rotate",
      entity_type: "agent_settings",
      metadata: { kind: data.kind } as any,
    });

    return { value };
  });
