import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

export const verifyMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("meta_access_token, meta_page_id")
      .eq("id", 1)
      .maybeSingle();

    if (!settings?.meta_access_token || !settings?.meta_page_id) {
      throw new Error("Meta credentials missing");
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${settings.meta_page_id}?fields=name,link&access_token=${settings.meta_access_token}`
      );
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return { 
        success: true, 
        pageName: result.name,
        pageLink: result.link
      };
    } catch (error: any) {
      console.error("Meta Verification Error:", error);
      throw new Error(error.message || "Failed to verify Meta connection");
    }
  });

export const getMetaWebhookConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Need a base URL for callback.
    // In TanStack Start context, we can construct it if we have access to process.env or just rely on a hardcoded origin
    // since we know the app is deployed to *.lovable.app.
    // For now, let's use a standard pattern.
    const callbackUrl = `${process.env['VITE_PUBLIC_APP_URL'] || 'https://daddyai.lovable.app'}/api/public/webhooks/meta`;
    
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("meta_webhook_verify_token")
      .eq("id", 1)
      .maybeSingle();

    return {
      callbackUrl,
      verifyToken: settings?.meta_webhook_verify_token || "daddy_ai_meta_verify_token"
    };
  });
