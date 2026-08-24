import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";
import { chatComplete, type ChatMessage } from "./ai.server";

/** Fetch approved training pairs for question generation */
export const getTrainingPairsForGeneration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data } = await supabaseAdmin
      .from("training_pairs")
      .select("id, question, answer, source")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(200);

    return data ?? [];
  });

/** Use LLM to generate realistic customer questions from selected training pairs */
export const generateCustomerQuestions = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          pairIds: z.array(z.string().uuid()).min(1).max(50),
        })
        .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch the selected training pairs
    const { data: pairs } = await supabaseAdmin
      .from("training_pairs")
      .select("question, answer")
      .in("id", data.pairIds)
      .eq("status", "approved");

    if (!pairs || pairs.length === 0) {
      return { questions: [] };
    }

    // Build context for the LLM
    const pairBlock = pairs
      .map((p, i) => `${i + 1}. Customer asked: "${p.question}" → We answered: "${p.answer}"`)
      .join("\n");

    const settings = await supabaseAdmin
      .from("agent_settings")
      .select("lovable_api_key_override")
      .eq("id", 1)
      .maybeSingle();

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a customer behavior simulator for a Bengali e-commerce business called "Wear Impressive" that sells clothing, fashion items, and accessories.

Based on the following real Q&A pairs from the business, generate 8-12 realistic customer questions that a real person would ask on Messenger, WhatsApp, or Instagram. The questions should:
- Be in the same language style as the examples (Bengali, English, or Banglish)
- Cover different angles: pricing, availability, sizing, shipping, returns, comparisons, bulk orders, etc.
- Sound natural and conversational, like real social media messages
- Vary in complexity (simple product queries, multi-part questions, edge cases)

Return ONLY a JSON array of objects with "question" and "angle" fields. Example:
[{"question": "এই ড্রেসটা ৩২ সাইজ আছে?", "angle": "sizing"}]

REAL Q&A PAIRS:
${pairBlock}`,
      },
    ];

    const response = await chatComplete(
      messages,
      "openai/gpt-4o-mini",
      (settings as any)?.lovable_api_key_override,
    );

    const text = typeof response === "string" ? response : "";

    // Parse JSON from response (handle markdown code blocks)
    let questions: Array<{ question: string; angle: string }> = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If parsing fails, return empty
      console.error("Failed to parse generated questions:", text.slice(0, 200));
    }

    return { questions };
  });

/** Test generated questions against the AI using the RAG pipeline */
export const testQuestions = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          questions: z.array(z.string().min(1).max(500)).min(1).max(20),
        })
        .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "viewer");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load settings
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("system_prompt, lovable_api_key_override")
      .eq("id", 1)
      .maybeSingle();

    const results: Array<{ question: string; reply: string; sources: Array<{ question: string; answer: string }> }> = [];

    for (const q of data.questions) {
      // RAG: find matching examples
      const { data: examples } = await supabaseAdmin.rpc("search_training_pairs", {
        _query: q.slice(0, 300),
        _limit: 5,
      });

      const exList = (examples ?? []) as Array<{ question: string; answer: string; score: number }>;

      const exampleBlock = exList.length
        ? exList
            .map((e, i) => `Example ${i + 1}:\nCustomer: ${e.question}\nWe: ${e.answer}`)
            .join("\n\n")
        : "No matching examples found.";

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `${settings?.system_prompt ?? ""}

Language Priority: Respond in the language used by the customer (Bengali, English, or Banglish). Keep replies short (1-3 lines), like a social media page reply.

${exampleBlock}`,
        },
        { role: "user", content: q },
      ];

      const response = await chatComplete(
        messages,
        "openai/gpt-4o-mini",
        settings?.lovable_api_key_override,
      );

      results.push({
        question: q,
        reply: typeof response === "string" ? response : "",
        sources: exList.map((e) => ({ question: e.question, answer: e.answer })),
      });
    }

    return { results };
  });

/** Save an improved Q&A pair as a skill (approved training pair) */
export const saveSkill = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          question: z.string().min(1).max(2000),
          answer: z.string().min(1).max(4000),
        })
        .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert by question to avoid duplicates
    const { error } = await supabaseAdmin
      .from("training_pairs")
      .upsert(
        {
          question: data.question,
          answer: data.answer,
          status: "approved",
          source: "skill_builder",
        },
        { onConflict: "question" },
      );

    if (error) throw new Error(error.message);

    return { ok: true };
  });
