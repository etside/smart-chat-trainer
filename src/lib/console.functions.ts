import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateReply } from "./agent.server";
import { chatComplete, transcribeAudio } from "./ai.server";
import { assertAdmin, generateApiKey, hashApiKey } from "./admin.server";

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { role: (data?.role as "admin" | "editor" | "viewer") || "user" };
  });

/** @deprecated Use getMyRole instead */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { role } = await getMyRole();
    return { admin: role === "admin" };
  });

export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const pairCount = async (status: "approved" | "pending" | "rejected") => {
      const { count } = await supabaseAdmin
        .from("training_pairs")
        .select("*", { count: "exact", head: true })
        .eq("status", status);
      return count ?? 0;
    };

    const [convRes, msgRes, approved, pending, rejected, settingsRes] = await Promise.all([
      supabaseAdmin.from("conversations").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("messages").select("*", { count: "exact", head: true }),
      pairCount("approved"),
      pairCount("pending"),
      pairCount("rejected"),
      supabaseAdmin.from("agent_settings").select("credit_usage").eq("id", 1).maybeSingle(),
    ]);
    
    return { 
      conversations: convRes.count ?? 0, 
      messages: msgRes.count ?? 0, 
      approved, 
      pending, 
      rejected,
      creditUsage: settingsRes.data?.credit_usage ?? 0
    };
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
      .select("system_prompt, model, auto_approve, lovable_api_key_override, credit_usage")
      .eq("id", 1)
      .maybeSingle();
    return (
      data ?? { 
        system_prompt: "", 
        model: "openai/gpt-5.6-sol", 
        auto_approve: false,
        lovable_api_key_override: "",
        credit_usage: 0
      }
    );
  });

export const saveAgentSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        system_prompt: z.string().max(8000),
        model: z.string().max(60),
        auto_approve: z.boolean(),
        lovable_api_key_override: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("agent_settings")
      .update({ 
        system_prompt: data.system_prompt,
        model: data.model,
        auto_approve: data.auto_approve,
        lovable_api_key_override: data.lovable_api_key_override ?? null,
        updated_at: new Date().toISOString() 
      })
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
      .select("id, name, key_prefix, revoked, last_used_at, created_at, version_id")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(60), version_id: z.string().uuid().optional() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = generateApiKey();
    await supabaseAdmin.from("api_keys").insert({
      name: data.name,
      key_hash: await hashApiKey(key),
      key_prefix: key.slice(0, 10),
      version_id: data.version_id ?? null,
    });
    return { key };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("api_keys").delete().eq("id", data.id);
    return { ok: true };
  });

export const rotateApiKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: oldKey } = await supabaseAdmin
      .from("api_keys")
      .select("name, version_id")
      .eq("id", data.id)
      .single();
      
    if (!oldKey) throw new Error("Key not found");
    
    const newRawKey = generateApiKey();
    const newHash = await hashApiKey(newRawKey);
    
    await supabaseAdmin.from("api_keys").delete().eq("id", data.id);
    await supabaseAdmin.from("api_keys").insert({
      name: oldKey.name,
      key_hash: newHash,
      key_prefix: newRawKey.slice(0, 10),
      version_id: oldKey.version_id
    });
    
    return { key: newRawKey };
  });

export const getTrainingJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("training_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const getTrainingVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("training_versions")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const triggerTraining = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => 
    z.object({ 
      version_id: z.string().uuid().optional(),
      sync_run_id: z.string().uuid().optional()
    }).parse(d || {})
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create a new job record
    const { data: job, error } = await supabaseAdmin
      .from("training_jobs")
      .insert({
        status: "running", // Matches CHECK constraint
        sync_run_id: data.sync_run_id || null
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Training job creation error:", error);
      throw new Error(`Failed to start training job: ${error.message}`);
    }

    // In a real app, this would be a background queue or edge function.
    // We update it after a short delay to simulate processing.
    const runTraining = async () => {
      try {
        const { data: approved } = await supabaseAdmin
          .from("training_pairs")
          .select("id")
          .eq("status", "approved");
        
        await supabaseAdmin
          .from("training_jobs")
          .update({
            status: "completed",
            finished_at: new Date().toISOString()
          } as any)
          .eq("id", job.id);
      } catch (err) {
        await supabaseAdmin
          .from("training_jobs")
          .update({
            status: "failed",
            error_log: err instanceof Error ? err.message : "Unknown error",
            finished_at: new Date().toISOString()
          } as any)
          .eq("id", job.id);
      }
    };

    // We don't await this so the function returns the job_id immediately
    runTraining();

    return { job_id: job.id };
  });

export const exportTrainingData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ type: z.enum(["training_pairs", "conversations"]) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from(data.type).select("*");
    return { json: JSON.stringify(rows ?? [], null, 2) };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("lovable_api_key_override")
      .eq("id", 1)
      .maybeSingle();

    const text = await transcribeAudio(data.audio, data.mimeType, settings?.lovable_api_key_override);
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

export const getTrainingJobDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => 
    z.object({ 
      id: z.string(), 
      search: z.string().optional(),
      page: z.number().int().default(0)
    }).parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: job } = await supabaseAdmin
      .from("training_jobs")
      .select("*")
      .eq("id", data.id)
      .single();
      
    const pageSize = 10;
    let query = supabaseAdmin
      .from("training_pairs")
      .select("id, question, answer, created_at, status", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, (data.page + 1) * pageSize - 1);

    if (data.search) {
      query = query.or(`question.ilike.%${data.search}%,answer.ilike.%${data.search}%`);
    }

    const { data: samples, count } = await query;

    return { 
      job: job as any, 
      samples: samples ?? [], 
      totalSamples: count ?? 0,
      pageSize 
    };
  });

export const exportTrainingRunLogs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: job } = await supabaseAdmin
      .from("training_jobs")
      .select("*")
      .eq("id", data.id)
      .single();

    if (!job) throw new Error("Job not found");

    const { data: samples } = await supabaseAdmin
      .from("training_pairs")
      .select("question, answer, created_at, status")
      .order("created_at", { ascending: false });

    const exportData = {
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
      finished_at: job.finished_at,
      processed_count: (job as any).processed_count,
      retry_count: (job as any).retry_count,
      error_log: job.error_log,
      samples: samples || []
    };

    return { json: JSON.stringify(exportData, null, 2) };
  });
