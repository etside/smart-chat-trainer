import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * List conversation flows
 */
export const listFlows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { data } = await supabaseAdmin
      .from("conversation_flows")
      .select("id, name, description, is_active, created_at, updated_at")
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

/**
 * Get a single flow with nodes and edges
 */
export const getFlow = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { data: flow } = await supabaseAdmin
      .from("conversation_flows")
      .select("*")
      .eq("id", data.id)
      .single();
    return flow;
  });

/**
 * Create a new conversation flow
 */
export const createFlow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
      .parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { data: flow, error } = await supabaseAdmin
      .from("conversation_flows")
      .insert({
        name: data.name,
        description: data.description || null,
        nodes: JSON.stringify([
          {
            id: "start",
            type: "start",
            position: { x: 250, y: 50 },
            data: { label: "Start" },
          },
        ]),
        edges: JSON.stringify([]),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: flow.id };
  });

/**
 * Save flow nodes and edges
 */
export const saveFlow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        nodes: z.array(z.any()).optional(),
        edges: z.array(z.any()).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { id, ...updates } = data;
    const filtered: Record<string, unknown> = { ['updated_at']: new Date().toISOString() };
    if (updates.name !== undefined) filtered['name'] = updates.name;
    if (updates.description !== undefined) filtered['description'] = updates.description;
    if (updates.nodes !== undefined) filtered['nodes'] = JSON.stringify(updates.nodes);
    if (updates.edges !== undefined) filtered['edges'] = JSON.stringify(updates.edges);
    if (updates.is_active !== undefined) filtered['is_active'] = updates.is_active;

    const { error } = await supabaseAdmin.from("conversation_flows").update(filtered as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Delete a conversation flow
 */
export const deleteFlow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "admin");
    await supabaseAdmin.from("conversation_flows").delete().eq("id", data.id);
    return { ok: true };
  });
