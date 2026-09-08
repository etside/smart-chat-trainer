import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listCannedResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { data } = await supabaseAdmin
      .from("canned_responses")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createCannedResponse = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(100),
        shortcut: z.string().max(20).optional(),
        category: z.string().max(50).default("general"),
        content: z.string().min(1).max(4000),
        template_text: z.string().min(1).max(4000).optional(),
        image_url: z.string().url().optional().or(z.literal("")),
        platform: z.enum(["messenger", "whatsapp", "instagram", "all"]).default("all"),
        language: z.enum(["bn", "en", "both"]).default("both"),
        variables: z.array(z.string()).default([]),
      })
      .parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const templateText = data.template_text || data.content;
    const { error } = await supabaseAdmin.from("canned_responses").insert({
      name: data.name,
      shortcut: data.shortcut || null,
      category: data.category,
      content: templateText,
      template_text: templateText,
      image_url: data.image_url || null,
      platform: data.platform,
      language: data.language,
      variables: data.variables,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCannedResponse = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        shortcut: z.string().max(20).optional(),
        category: z.string().max(50).optional(),
        content: z.string().min(1).max(4000).optional(),
        template_text: z.string().min(1).max(4000).optional(),
        image_url: z.string().url().optional().or(z.literal("")).nullable(),
        platform: z.enum(["messenger", "whatsapp", "instagram", "all"]).optional(),
        language: z.enum(["bn", "en", "both"]).optional(),
        variables: z.array(z.string()).optional(),
      })
      .parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { id, ...updates } = data;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) filtered[k] = v;
    }
    // Keep content in sync with template_text
    if (filtered.template_text) filtered.content = filtered.template_text;
    if (filtered.content && !filtered.template_text) filtered.template_text = filtered.content;
    filtered['updated_at'] = new Date().toISOString();
    const { error } = await supabaseAdmin.from("canned_responses").update(filtered as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCannedResponse = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    await supabaseAdmin.from("canned_responses").delete().eq("id", data.id);
    return { ok: true };
  });

/**
 * Use a canned response (increment usage or track analytics)
 */
export const useCannedResponse = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    // Track usage event
    await supabaseAdmin.from("analytics_events").insert({
      event_type: "canned_response_used",
      metadata: { canned_response_id: data.id },
    });
    return { ok: true };
  });
