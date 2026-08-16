import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";

export const getWebhookLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data } = await supabaseAdmin
      .from("messages")
      .select(`
        id,
        content,
        role,
        created_at,
        conversations (
          id,
          platform,
          external_id
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);
      
    return data ?? [];
  });
