import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getWebhookLogs = createServerFn({ method: "GET" })
  .handler(async () => {
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
    const { data, error } = await supabaseAdmin
      .from("agent_settings")
      .select("data_policy_content")
      .eq("id", 1)
      .maybeSingle();
    
    if (error) throw new Error(error.message);
    return data?.data_policy_content || "# Data Policy\n\nYour data policy content here...";
  });

export const updateDataPolicy = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ content: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("agent_settings")
      .update({ data_policy_content: data.content })
      .eq("id", 1);
    
    if (error) throw new Error(error.message);
    return { success: true };
  });
