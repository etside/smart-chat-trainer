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
      publish: z.boolean().default(true),
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const base = {
      name: data.name,
      platform: data.platform,
      language: data.language,
      template_text: data.template_text,
      variables: data.variables,
    };

    let templateId = data.id ?? null;
    let liveVersion = 1;

    if (templateId) {
      const { data: current } = await supabaseAdmin
        .from("auto_reply_templates")
        .select("version")
        .eq("id", templateId)
        .maybeSingle();
      liveVersion = ((current as any)?.version ?? 1) + 1;

      if (data.publish) {
        await supabaseAdmin
          .from("auto_reply_templates")
          .update({ ...base, version: liveVersion, status: "published", updated_at: new Date().toISOString() } as any)
          .eq("id", templateId);
      }
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("auto_reply_templates")
        .insert({ ...base, version: 1, status: data.publish ? "published" : "draft" } as any)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      templateId = created.id;
    }

    // Every save is captured as an immutable version snapshot.
    const { data: last } = await supabaseAdmin
      .from("auto_reply_template_versions")
      .select("version")
      .eq("template_id", templateId!)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabaseAdmin.from("auto_reply_template_versions").insert({
      template_id: templateId!,
      version: ((last as any)?.version ?? 0) + 1,
      ...base,
      variables: data.variables as any,
      status: data.publish ? "published" : "draft",
      created_by: context.userId,
    } as any);

    return { ok: true, id: templateId, published: data.publish };
  });

export const listTemplateVersions = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ template_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("auto_reply_template_versions")
      .select("*")
      .eq("template_id", data.template_id)
      .order("version", { ascending: false });
    return rows ?? [];
  });

export const publishTemplateVersion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ version_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: version, error } = await supabaseAdmin
      .from("auto_reply_template_versions")
      .select("*")
      .eq("id", data.version_id)
      .single();
    if (error || !version) throw new Error("Version not found");

    const v: any = version;
    await supabaseAdmin
      .from("auto_reply_templates")
      .update({
        name: v.name,
        platform: v.platform,
        language: v.language,
        template_text: v.template_text,
        variables: v.variables,
        version: v.version,
        status: "published",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", v.template_id);

    await supabaseAdmin
      .from("auto_reply_template_versions")
      .update({ status: "published" } as any)
      .eq("id", v.id);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "template.publish",
      entity_type: "auto_reply_templates",
      entity_id: v.template_id,
      metadata: { version: v.version } as any,
    });

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
