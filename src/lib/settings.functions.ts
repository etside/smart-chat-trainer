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
