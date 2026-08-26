import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

const WEAR_IMPRESSIVE_API = "https://api.v2.wearimpressive.com/api/ai/webhook";

async function signPayload(body: string, secret: string): Promise<string> {
  const { createHmac } = await import("crypto");
  return createHmac("sha256", secret).update(body).digest("hex");
}

export const getSyncCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("sync_token, sync_secret")
      .eq("id", 1)
      .maybeSingle();
    
    return {
      token: data?.sync_token ? "••••••••" : "",
      secret: data?.sync_secret ? "••••••••" : ""
    };
  });

export const updateSyncCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => 
    z.object({ 
      token: z.string().min(1), 
      secret: z.string().min(1) 
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update({ 
        sync_token: data.token, 
        sync_secret: data.secret 
      })
      .eq("id", 1);
      
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMetaCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("meta_app_id, meta_app_secret, meta_access_token, meta_page_id, meta_whatsapp_business_account_id, meta_webhook_verify_token, meta_api_version")
      .eq("id", 1)
      .maybeSingle();

    return {
      appId: data?.meta_app_id || "",
      appSecret: data?.meta_app_secret ? "••••••••" : "",
      accessToken: data?.meta_access_token ? "••••••••" : "",
      pageId: data?.meta_page_id || "",
      whatsappId: data?.meta_whatsapp_business_account_id || "",
      verifyToken: data?.meta_webhook_verify_token || "",
      apiVersion: data?.meta_api_version || "v19.0"
    };
  });

/** Public subset — no auth, for __root.tsx Meta SDK init */
export const getMetaCredentialsPublic = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("meta_app_id, meta_api_version")
      .eq("id", 1)
      .maybeSingle();

    return {
      appId: data?.meta_app_id || "",
      apiVersion: (data as any)?.meta_api_version || "v19.0"
    };
  });

export const updateMetaCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => 
    z.object({ 
      appId: z.string().optional(),
      appSecret: z.string().optional(),
      accessToken: z.string().optional(),
      pageId: z.string().optional(),
      whatsappId: z.string().optional(),
      verifyToken: z.string().optional(),
      apiVersion: z.string().optional()
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const updateData: any = {};
    if (data.appId !== undefined) updateData.meta_app_id = data.appId;
    if (data.appSecret !== undefined && data.appSecret !== "••••••••") updateData.meta_app_secret = data.appSecret;
    if (data.accessToken !== undefined && data.accessToken !== "••••••••") updateData.meta_access_token = data.accessToken;
    if (data.pageId !== undefined) updateData.meta_page_id = data.pageId;
    if (data.whatsappId !== undefined) updateData.meta_whatsapp_business_account_id = data.whatsappId;
    if (data.verifyToken !== undefined) updateData.meta_webhook_verify_token = data.verifyToken;
    if (data.apiVersion !== undefined) updateData.meta_api_version = data.apiVersion;

    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update(updateData)
      .eq("id", 1);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWearImpressiveConnection = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ action: z.enum(["catalog", "stock", "store_info"]).optional(), productId: z.number().optional() }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("sync_token, sync_secret")
      .eq("id", 1)
      .maybeSingle();

    const token = settings?.sync_token;
    const secret = settings?.sync_secret;
    if (!token || !secret) {
      return { ok: false, error: "Sync credentials not configured." };
    }

    const action = data.action || "store_info";
    const payload: Record<string, any> = { action, per_page: 3 };
    if (data.productId) payload["product_id"] = data.productId;
    const body = JSON.stringify(payload);
    const sig = await signPayload(body, secret);

    try {
      const res = await fetch(WEAR_IMPRESSIVE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-AI-Signature": `sha256=${sig}`,
        },
        body,
      });
      const json = await res.json();
      return { ok: json.success, data: json.data, error: json.message };
    } catch (e: any) {
      return { ok: false, error: e.message || "Connection failed" };
    }
  });
