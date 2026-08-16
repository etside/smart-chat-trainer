import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getWebhookLogs = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin
      .from("webhook_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (error) throw new Error(error.message);
    return data;
  });

export const getDataPolicy = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin
      .from("agent_settings")
      .select("data_policy_content")
      .eq("id", 1)
      .maybeSingle();
    
    if (error) throw new Error(error.message);
    return (data as any)?.data_policy_content || "# Data Policy\n\nYour data policy content here...";
  });

export const updateDataPolicy = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ content: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update({ data_policy_content: data.content } as any)
      .eq("id", 1);
    
    if (error) throw new Error(error.message);
    return { success: true };
  });
