import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRole } from "./admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Generate embedding vector from text using MiMo embeddings API.
 * Falls back to null if embedding service unavailable.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const GATEWAY = process.env["AI_GATEWAY_URL"] || "https://api.xiaomimimo.com/v1";
    const API_KEY = process.env["MIMO_API_KEY"] || "";
    if (!API_KEY) return null;

    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * Embed a single training pair
 */
export const embedTrainingPair = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, "editor");

    const { data: pair } = await supabaseAdmin
      .from("training_pairs")
      .select("id, question, answer")
      .eq("id", data.id)
      .single();

    if (!pair) throw new Error("Training pair not found");

    const text = `${pair.question}\n${pair.answer}`;
    const embedding = await generateEmbedding(text);

    if (embedding) {
      await supabaseAdmin
        .from("training_pairs")
        .update({ embedding: `[${embedding.join(",")}]` })
        .eq("id", data.id);
    }

    return { ok: true, embedded: !!embedding };
  });

/**
 * Batch embed all approved training pairs that don't have embeddings
 */
export const embedAllPairs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, "admin");

    const { data: pairs } = await supabaseAdmin
      .from("training_pairs")
      .select("id, question, answer")
      .eq("status", "approved")
      .is("embedding", null)
      .limit(100);

    if (!pairs?.length) return { embedded: 0 };

    let embedded = 0;
    for (const pair of pairs) {
      const text = `${pair.question}\n${pair.answer}`;
      const embedding = await generateEmbedding(text);
      if (embedding) {
        await supabaseAdmin
          .from("training_pairs")
          .update({ embedding: `[${embedding.join(",")}]` })
          .eq("id", pair.id);
        embedded++;
        // Rate limit: 100ms between calls
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return { embedded };
  });

/**
 * Semantic search using pgvector
 */
export const semanticSearch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().min(1).max(1000), limit: z.number().int().min(1).max(20).default(8) }).parse(d)
  )
  .handler(async ({ data }) => {
    const embedding = await generateEmbedding(data.query);
    if (!embedding) {
      // Fallback to text search
      const { data: results } = await supabaseAdmin
        .from("training_pairs")
        .select("id, question, answer")
        .eq("status", "approved")
        .or(`question.ilike.%${data.query}%,answer.ilike.%${data.query}%`)
        .limit(data.limit);

      return {
        results: results?.map((r) => ({ id: r.id, question: r.question, answer: r.answer, score: 0.5 })) ?? [],
        method: "text_fallback",
      };
    }

    const { data: results, error } = await supabaseAdmin.rpc("search_training_pairs_semantic", {
      _embedding: `[${embedding.join(",")}]`,
      _limit: data.limit,
    });

    if (error) {
      // Fallback to text search
      const { data: fallback } = await supabaseAdmin
        .from("training_pairs")
        .select("id, question, answer")
        .eq("status", "approved")
        .or(`question.ilike.%${data.query}%,answer.ilike.%${data.query}%`)
        .limit(data.limit);

      return {
        results: fallback?.map((r) => ({ id: r.id, question: r.question, answer: r.answer, score: 0.5 })) ?? [],
        method: "text_fallback",
      };
    }

    return { results: results ?? [], method: "vector" };
  });
