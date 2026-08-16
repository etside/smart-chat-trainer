import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("auto_reply_templates")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(100),
      platform: z.enum(['messenger', 'whatsapp', 'instagram', 'web', 'all']),
      language: z.enum(['en', 'bn', 'banglish']),
      template_text: z.string().min(1).max(2000),
      variables: z.array(z.string()).default([]),
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      name: data.name,
      platform: data.platform,
      language: data.language,
      template_text: data.template_text,
      variables: data.variables,
      updated_at: new Date().toISOString()
    };

    if (data.id) {
      await supabaseAdmin
        .from("auto_reply_templates")
        .update(payload)
        .eq("id", data.id);
    } else {
      await supabaseAdmin
        .from("auto_reply_templates")
        .insert(payload);
    }
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("auto_reply_templates").delete().eq("id", data.id);
    return { ok: true };
  });
