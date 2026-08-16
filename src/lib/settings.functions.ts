import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

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
      .select("meta_app_id, meta_app_secret, meta_access_token, meta_page_id, meta_whatsapp_business_account_id, meta_webhook_verify_token")
      .eq("id", 1)
      .maybeSingle();
    
    return {
      appId: data?.meta_app_id || "",
      appSecret: data?.meta_app_secret ? "••••••••" : "",
      accessToken: data?.meta_access_token ? "••••••••" : "",
      pageId: data?.meta_page_id || "",
      whatsappId: data?.meta_whatsapp_business_account_id || "",
      verifyToken: data?.meta_webhook_verify_token || ""
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
      verifyToken: z.string().optional()
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

    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update(updateData)
      .eq("id", 1);
      
    if (error) throw new Error(error.message);
    return { ok: true };
  });
