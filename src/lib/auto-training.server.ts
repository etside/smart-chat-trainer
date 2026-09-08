/**
 * Daddy AI — Auto-Training Engine v2
 *
 * Improved version with:
 * - Better AI prompts for more natural, sales-focused responses
 * - Multi-language support (Bengali, Banglish, English)
 * - Context-aware answers using product catalog
 * - Better confidence calculation
 * - Smarter topic deduplication
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pool } from "@/integrations/supabase/pg-client";
import { chatComplete } from "./ai.server";

export interface AutoTrainResult {
  pairs_generated: number;
  pairs_approved: number;
  confidence_score: number;
  needs_more_training: boolean;
  topics_covered: string[];
  run_id: string;
}

// ── Confidence calculation ────────────────────────────────────────────────────

async function computeConfidence(): Promise<number> {
  const [approvedRes, distinctRes] = await Promise.all([
    supabaseAdmin.from("training_pairs").select("id", { count: "exact" }).eq("status", "approved"),
    pool.query("SELECT COUNT(DISTINCT lower(trim(content))) AS cnt FROM messages WHERE role = 'user'"),
  ]);

  const approved = approvedRes.count ?? 0;
  const distinctTopics = parseInt(String(distinctRes.rows[0]?.cnt ?? "0"), 10);

  if (distinctTopics === 0) return approved > 0 ? 1.0 : 0.0;

  const unanswered = Math.max(distinctTopics - approved, 0);
  const ratio = Math.min(approved / Math.max(approved + unanswered, 1), 1.0);
  return Math.round(ratio * 100) / 100;
}

// ── Extract unanswered / weak topics from conversations ──────────────────────

async function getUnansweredTopics(limit = 30): Promise<string[]> {
  const { data: recentMsgs } = await supabaseAdmin
    .from("messages")
    .select("content")
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!recentMsgs?.length) return [];

  const userQuestions = recentMsgs.map(m => m.content.trim()).filter(q => q.length > 5);

  // Check which ones already have a training pair
  const covered = new Set<string>();
  for (const q of userQuestions) {
    const { data } = await supabaseAdmin
      .from("training_pairs")
      .select("id")
      .ilike("question", `%${q.slice(0, 50)}%`)
      .limit(1);
    if (data?.length) covered.add(q);
  }

  const uncovered = userQuestions.filter(q => !covered.has(q));
  // Deduplicate similar questions using better similarity
  const unique: string[] = [];
  for (const q of uncovered) {
    const normalized = q.toLowerCase().replace(/[^\w\s]/g, "").slice(0, 40);
    if (!unique.some(u => {
      const uNorm = u.toLowerCase().replace(/[^\w\s]/g, "").slice(0, 40);
      // Check if 70%+ of words overlap
      const words1 = new Set(normalized.split(/\s+/));
      const words2 = new Set(uNorm.split(/\s+/));
      const overlap = [...words1].filter(w => words2.has(w)).length;
      return overlap / Math.max(words1.size, 1) > 0.7;
    })) unique.push(q);
    if (unique.length >= limit) break;
  }
  return unique;
}

// ── AI: generate Q&A pairs from a batch of topics ───────────────────────────

async function generatePairsFromTopics(
  topics: string[],
  productContext: string,
  apiKey?: string | null,
): Promise<Array<{ question: string; answer: string; language: string }>> {
  if (!topics.length) return [];

  const prompt = `You are a training data generator for a Bangladeshi fashion e-commerce AI sales agent called "Daddy AI".

Product catalogue context:
${productContext}

Generate natural, helpful Q&A training pairs for each of these customer questions.

STRICT RULES:
1. Reply in the SAME language as the question (Bengali/Banglish/English)
2. Answers must be SHORT (1-3 sentences), direct, and sales-focused
3. Always include price, stock status, and product URL when relevant
4. Never make up prices — use "দাম জানতে কল করুন" if price unknown
5. Be warm, friendly, and professional — like a helpful shop assistant
6. For Bengali questions, use natural conversational Bengali (not formal)
7. For Banglish questions, use casual romanized Bengali
8. Include emojis sparingly for warmth (1-2 per reply max)
9. If asking about delivery, mention "ঢাকার ভিতরে ২-৩ দিন, বাইরে ৪-৫ দিন"
10. For order questions, always provide the product link

Customer questions:
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Return ONLY a JSON array of objects with keys: question, answer, language
No markdown, no explanation, just the JSON array:`;

  try {
    const response = await chatComplete(
      [{ role: "user", content: prompt }],
      undefined,
      apiKey,
    );
    const text = typeof response === "string" ? response : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: any) => p.question && p.answer && p.question.length > 3 && p.answer.length > 3)
      .map((p: any) => ({
        question: String(p.question).trim(),
        answer: String(p.answer).trim(),
        language: p.language || "bn",
      }));
  } catch (err) {
    console.error("[AutoTrain] pair generation failed:", err);
    return [];
  }
}

// ── Generate product-specific training from catalogue ────────────────────────

async function generateProductConversationPairs(
  apiKey?: string | null,
): Promise<Array<{ question: string; answer: string; language: string }>> {
  const { data: products } = await supabaseAdmin
    .from("product_catalogue")
    .select("name, price, image_url, product_url, category, brand, availability, stock, short_description, sizes, variants")
    .eq("availability", "in stock")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (!products?.length) return [];

  const pairs: Array<{ question: string; answer: string; language: string }> = [];

  for (const p of products.slice(0, 10)) {
    const variantsArr = typeof p.variants === "string" ? JSON.parse(p.variants || "[]") : (p.variants ?? []);
    const sizeList = p.sizes?.join(", ") || variantsArr.map((v: any) => v.options?.size || v.name).filter(Boolean).join(", ");
    const imageNote = p.image_url ? ` ছবি দেখুন: ${p.image_url}` : "";
    const linkNote = p.product_url ? ` অর্ডার করুন: ${p.product_url}` : "";

    // Bengali conversational pairs — more natural
    pairs.push({
      question: `${p.name} এর দাম কত?`,
      answer: `${p.name} এর দাম ৳${p.price} টাকা।${p.availability === "in stock" ? ` এখন স্টকে আছে!` : " দুঃখিত, এই মুহূর্তে স্টকে নেই।"}${linkNote}${imageNote}`,
      language: "bn",
    });

    pairs.push({
      question: `${p.name} কি পাওয়া যাচ্ছে?`,
      answer: `হ্যাঁ! ${p.name} ${p.availability === "in stock" ? `স্টকে আছে (${p.stock || "সীমিত"} পিস)।` : "এই মুহূর্তে স্টকে নেই, শীঘ্রই আসবে ইনশাআল্লাহ।"}${sizeList ? ` সাইজ: ${sizeList}।` : ""}${linkNote}`,
      language: "bn",
    });

    if (sizeList) {
      pairs.push({
        question: `${p.name} কোন কোন সাইজে পাওয়া যায়?`,
        answer: `${p.name} এই সাইজগুলোতে পাওয়া যাচ্ছে: ${sizeList}। আপনার সাইজ কত?${linkNote}`,
        language: "bn",
      });
    }

    // Order helper pair
    pairs.push({
      question: `${p.name} অর্ডার করতে চাই`,
      answer: `চমৎকার পছন্দ! ${p.name} অর্ডার করতে এই লিংকে যান: ${p.product_url || "আমাদের ওয়েবসাইট দেখুন"}। দাম: ৳${p.price}।${imageNote}`,
      language: "bn",
    });

    // English pairs
    pairs.push({
      question: `What is the price of ${p.name}?`,
      answer: `${p.name} is priced at ৳${p.price}.${p.availability === "in stock" ? " Currently in stock!" : " Currently out of stock."} Order here: ${p.product_url || "contact us"}`,
      language: "en",
    });

    // Delivery question
    pairs.push({
      question: `${p.name} ডেলিভারি কত দিন লাগবে?`,
      answer: `${p.name} ঢাকার ভিতরে ২-৩ দিন, ঢাকার বাইরে ৪-৫ দিন সময় লাগে। ক্যাশ অন ডেলিভারি পাওয়া যায়।${linkNote}`,
      language: "bn",
    });
  }

  return pairs;
}

// ── Main: runAutoTraining ─────────────────────────────────────────────────────

const AUTO_TRAIN_DEADLINE_MS = 60_000;

function deadlineReached(startedAt: number): boolean {
  return Date.now() - startedAt >= AUTO_TRAIN_DEADLINE_MS;
}

async function withDeadline<T extends unknown[]>(
  task: Promise<T>,
  startedAt: number,
  label: string
): Promise<T> {
  const remaining = AUTO_TRAIN_DEADLINE_MS - (Date.now() - startedAt);
  if (remaining <= 0) {
    console.warn(`[AutoTrain] deadline reached before ${label} — skipping`);
    return [] as unknown as T;
  }

  const result = await Promise.race([
    task,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`[AutoTrain] ${label} exceeded deadline — bailing to keep cron responsive`);
        resolve([] as unknown as T);
      }, Math.max(0, remaining))
    ),
  ]);
  return result;
}

export async function runAutoTraining(maxPairs = 20): Promise<AutoTrainResult> {
  // Recover any stale "running" runs
  try {
    await supabaseAdmin
      .from("auto_training_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: "stale run recovered (previous run wedged or crashed)",
      })
      .eq("status", "running");
  } catch (e) {
    console.error("[AutoTrain] stale run recovery failed:", e);
  }

  const { data: run } = await supabaseAdmin
    .from("auto_training_runs")
    .insert({ status: "running" })
    .select("id").single();

  const runId = run?.id ?? crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const { data: settings } = await supabaseAdmin
      .from("agent_settings")
      .select("lovable_api_key_override, training_confidence_threshold")
      .eq("id", 1).maybeSingle();

    const apiKey = settings?.lovable_api_key_override ?? null;
    const threshold = settings?.training_confidence_threshold ?? 0.85;

    const currentConfidence = await computeConfidence();

    let pairsGenerated = 0;
    let pairsApproved = 0;
    const topicsCovered: string[] = [];

    if (currentConfidence < threshold) {
      // Phase 1: Product-specific pairs (deterministic, NO AI)
      {
        const productPairs = await generateProductConversationPairs(apiKey);
        for (const pair of productPairs.slice(0, Math.max(0, maxPairs - pairsGenerated))) {
          const { error } = await supabaseAdmin.from("training_pairs").upsert({
            question: pair.question,
            answer: pair.answer,
            status: "approved",
            source: "auto_train_product",
            language: pair.language,
          }, { onConflict: "question" });

          if (!error) {
            pairsApproved++;
            topicsCovered.push(pair.question.slice(0, 50));
          }
          pairsGenerated++;
        }
      }

      // Phase 2: Generate from unanswered conversation topics (AI)
      const unanswered = await getUnansweredTopics(Math.min(maxPairs, 15));

      const { data: sampleProducts } = await supabaseAdmin
        .from("product_catalogue")
        .select("name, price, product_url, availability, stock, category")
        .limit(15);
      const productContext = sampleProducts?.map(p =>
        `- ${p.name}: ৳${p.price}, ${p.availability}, stock: ${p.stock}, ${p.product_url}`
      ).join("\n") || "No products loaded yet";

      if (unanswered.length > 0 && !deadlineReached(startedAt)) {
        const generated = await withDeadline(
          generatePairsFromTopics(unanswered, productContext, apiKey),
          startedAt,
          'phase 2 topics'
        );

        for (const pair of generated.slice(0, Math.max(0, maxPairs - pairsGenerated))) {
          if (deadlineReached(startedAt)) break;
          const { error } = await supabaseAdmin.from("training_pairs").upsert({
            question: pair.question,
            answer: pair.answer,
            status: "approved",
            source: "auto_train",
            language: pair.language,
          }, { onConflict: "question" });

          if (!error) {
            pairsApproved++;
            topicsCovered.push(pair.question.slice(0, 50));
          }
          pairsGenerated++;
        }
      }
    }

    const newConfidence = await computeConfidence();

    await supabaseAdmin.from("agent_settings").update({
      training_confidence_score: newConfidence,
      last_auto_train_at: new Date().toISOString(),
    }).eq("id", 1);

    await supabaseAdmin.from("auto_training_runs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      pairs_analyzed: topicsCovered.length,
      pairs_generated: pairsGenerated,
      confidence_score: newConfidence,
    }).eq("id", runId);

    const result: AutoTrainResult = {
      pairs_generated: pairsGenerated,
      pairs_approved: pairsApproved,
      confidence_score: newConfidence,
      needs_more_training: newConfidence < threshold,
      topics_covered: topicsCovered,
      run_id: runId,
    };

    console.log(`[AutoTrain] done: ${pairsApproved} pairs, confidence ${newConfidence} (threshold ${threshold})`);
    return result;
  } catch (err: any) {
    await supabaseAdmin.from("auto_training_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: err.message,
    }).eq("id", runId);
    throw err;
  }
}
