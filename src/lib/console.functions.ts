import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateReply } from "./agent.server";
import { chatComplete, transcribeAudio } from "./ai.server";
import { assertAdmin, generateApiKey, hashApiKey } from "./admin.server";

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: Boolean(data) };
  });

export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const count = async (table: "conversations" | "messages" | "training_pairs", status?: string) => {
      let q = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
      if (status) q = q.eq("status", status);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [conversations, messages, approved, pending, rejected] = await Promise.all([
      count("conversations"),
      count("messages"),
      count("training_pairs", "approved"),
      count("training_pairs", "pending"),
      count("training_pairs", "rejected"),
    ]);

    return { conversations, messages, approved, pending, rejected };
  });

export const listPairs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        status: z.enum(["all", "approved", "pending", "rejected"]).default("all"),
        page: z.number().int().min(0).default(0),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const size = 25;
    let q = supabaseAdmin
      .from("training_pairs")
      .select("id, question, answer, status, source, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * size, data.page * size + size - 1);

    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search?.trim()) {
      const term = data.search.trim().replace(/[%,]/g, " ");
      q = q.or(`question.ilike.%${term}%,answer.ilike.%${term}%`);
    }

    const { data: rows, count } = await q;
    return { rows: rows ?? [], total: count ?? 0, page: data.page, size };
  });

export const savePair = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        question: z.string().min(1).max(2000),
        answer: z.string().min(1).max(4000),
        status: z.enum(["approved", "pending", "rejected"]).default("approved"),
        source: z.string().max(40).default("manual"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.id) {
      await supabaseAdmin
        .from("training_pairs")
        .update({ question: data.question, answer: data.answer, status: data.status })
        .eq("id", data.id);
      return { ok: true };
    }

    await supabaseAdmin.from("training_pairs").insert({
      question: data.question,
      answer: data.answer,
      status: data.status,
      source: data.source,
    });
    return { ok: true };
  });

export const setPairStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum(["approved", "pending", "rejected"]),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("training_pairs").update({ status: data.status }).in("id", data.ids);
    return { ok: true };
  });

export const deletePair = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("training_pairs").delete().eq("id", data.id);
    return { ok: true };
  });

export const importPairs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        items: z
          .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
          .min(1)
          .max(2000),
        status: z.enum(["approved", "pending"]).default("approved"),
        source: z.string().max(40).default("manual"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("training_pairs").insert(
      data.items.map((i) => ({
        question: i.question.slice(0, 2000),
        answer: i.answer.slice(0, 4000),
        status: data.status,
        source: data.source,
      })),
    );
    return { inserted: data.items.length };
  });

export const importConversationsJson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ json: z.string().min(2).max(4_000_000) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { importConversationExport } = await import("./import.server");
    return importConversationExport(data.json);
  });

export const getAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("agent_settings")
      .select("system_prompt, model, auto_approve")
      .eq("id", 1)
      .maybeSingle();
    return (
      data ?? { system_prompt: "", model: "openai/gpt-5.6-sol", auto_approve: false }
    );
  });

export const saveAgentSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        system_prompt: z.string().max(8000),
        model: z.string().max(60),
        auto_approve: z.boolean(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("agent_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return { ok: true };
  });

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, revoked, last_used_at, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(60) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = generateApiKey();
    await supabaseAdmin.from("api_keys").insert({
      name: data.name,
      key_hash: await hashApiKey(key),
      key_prefix: key.slice(0, 10),
    });
    return { key };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("api_keys").update({ revoked: true }).eq("id", data.id);
    return { ok: true };
  });

export const playgroundReply = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        message: z.string().min(1).max(2000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
          .max(20)
          .default([]),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return generateReply(data.message, data.history);
  });

export const transcribeVoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        audio: z.string().min(10).max(20_000_000),
        mimeType: z.string().max(60).default("audio/webm"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const text = await transcribeAudio(data.audio, data.mimeType);
    return { text };
  });

export const extractPairsFromText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ text: z.string().min(2).max(12000) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            'তুমি একটি ট্রেনিং-ডেটা এক্সট্রাক্টর। ইনপুট টেক্সট (বাংলা/বাংলিশ, ভয়েস ট্রান্সক্রিপ্ট হতে পারে) থেকে কাস্টমার-প্রশ্ন ও দোকানের উত্তরের জোড়া বের করো। শুধু JSON অ্যারে দাও, অন্য কিছু লিখবে না। ফরম্যাট: [{"question":"...","answer":"..."}]. যদি টেক্সটে শুধু তথ্য/নিয়ম থাকে, তাহলে সম্ভাব্য কাস্টমার প্রশ্ন নিজে বানিয়ে সেই তথ্য দিয়ে উত্তর সাজাও। সর্বোচ্চ ১০টি জোড়া।',
        },
        { role: "user", content: data.text },
      ],
      "openai/gpt-5.6-terra",
    );

    const match = raw.match(/\[[\s\S]*\]/);
    let items: Array<{ question: string; answer: string }> = [];
    try {
      const parsed = JSON.parse(match ? match[0] : raw) as unknown;
      if (Array.isArray(parsed)) {
        items = parsed
          .filter(
            (p): p is { question: string; answer: string } =>
              typeof (p as { question?: unknown })?.question === "string" &&
              typeof (p as { answer?: unknown })?.answer === "string",
          )
          .slice(0, 10);
      }
    } catch {
      items = [];
    }
    return { items };
  });
