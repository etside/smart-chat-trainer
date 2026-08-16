import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatComplete, type ChatMessage } from "./ai.server";
import { logActionUsage } from "./usage.functions";


// Cache for stock lookups to prevent excessive API calls
const stockCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const RATE_LIMIT_MS = 2000; // 2 seconds between lookups per key
const lastLookup: Record<string, number> = {};

async function getFreshStockData(query: string) {
  const now = Date.now();
  if (lastLookup[query] && now - lastLookup[query] < RATE_LIMIT_MS) {
    console.log("Rate limiting stock lookup for:", query);
    return stockCache[query]?.data;
  }
  
  if (stockCache[query] && now - stockCache[query].timestamp < CACHE_TTL) {
    return stockCache[query].data;
  }

  lastLookup[query] = now;
  // Logic to fetch from training_pairs which acts as our inventory cache
  const { data } = await supabaseAdmin
    .from("training_pairs")
    .select("answer")
    .ilike("question", `%${query}%`)
    .eq("source", "api_sync")
    .maybeSingle();

  if (data) {
    stockCache[query] = { data: data.answer, timestamp: now };
  }
  return data?.answer;
}

export type HistoryTurn = { role: "user" | "assistant"; content: string };

export async function getSettings() {
  const { data } = await supabaseAdmin
    .from("agent_settings")
    .select("system_prompt, model, auto_approve, lovable_api_key_override")
    .eq("id", 1)
    .maybeSingle();

  return {
    system_prompt: data?.system_prompt ?? "",
    model: data?.model ?? "openai/gpt-5.6-sol",
    auto_approve: data?.auto_approve ?? false,
    lovable_api_key_override: data?.lovable_api_key_override,
  };
}

export async function findExamples(query: string, limit = 8) {
  const { data } = await supabaseAdmin.rpc("search_training_pairs", {
    _query: query.slice(0, 300),
    _limit: limit,
  });
  return (data ?? []) as Array<{ question: string; answer: string; score: number }>;
}

export async function generateReply(
  message: string,
  history: HistoryTurn[] = [],
  versionId?: string | null,
): Promise<{ reply: string; examples: Array<{ question: string; answer: string }> }> {
  const settings = await getSettings();
  
  // Check for product-specific keywords and trigger real-time sync if needed
  const isProductQuery = /দাম|স্টক|স্টকে|inventory|price|stock|কত|আছে/.test(message);
  
  if (isProductQuery) {
    try {
      // Use caching/rate-limiting helper
      const productMatch = message.match(/[A-Za-z0-9 ]+/); // Simple heuristic for product name
      if (productMatch) {
        const freshData = await getFreshStockData(productMatch[0].trim());
        if (freshData) {
          console.log("Using fresh stock data for reply");
        }
      }

      // Trigger a silent background sync via the syncCatalog server function logic
      const { syncCatalog } = await import("./sync.functions");
      
      // We run this in the background
      (syncCatalog as any).handler({
        context: { supabase: supabaseAdmin, userId: "system_agent" },
        data: { idempotencyKey: `auto_sync_${new Date().toISOString().slice(0, 13)}` }
      }).catch((e: any) => console.error("Auto-sync failed:", e));
    } catch (e) {
      console.error("Failed to trigger real-time sync:", e);
    }
  }

  const examples = await findExamples(message);

  const exampleBlock = examples.length
    ? examples
    .map((e, i) => `উদাহরণ ${i + 1}:\nকাস্টমার: ${e.question}\nআমরা: ${e.answer}`)
    .join("\n\n")
    : "কোনো মিল পাওয়া যায়নি।";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${settings.system_prompt}

নিচে আমাদের আগের আসল কথোপকথন থেকে সবচেয়ে মিল থাকা উদাহরণ দেওয়া হলো। এই টোন, ভাষা ও তথ্য অনুসরণ করে উত্তর দাও। উত্তর ছোট রাখো (১-৩ লাইন), ঠিক যেভাবে পেজ থেকে রিপ্লাই দেওয়া হয়।

${exampleBlock}`,
    },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: message },
  ];

  const reply = await chatComplete(messages, settings.model, settings.lovable_api_key_override);
  
  // Log message usage
  await logActionUsage({ data: { action: "ai_message", metadata: { model: settings.model } } }).catch(console.error);
  
  return { reply, examples: examples.map((e) => ({ question: e.question, answer: e.answer })) };
}

export async function logConversation(
  externalId: string | null,
  source: string,
  turns: HistoryTurn[],
) {
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .insert({ external_id: externalId, source })
    .select("id")
    .single();

  if (!conv) return;

  await supabaseAdmin.from("messages").insert(
    turns.map((t, i) => ({
      conversation_id: conv.id,
      role: t.role,
      content: t.content,
      seq: i,
    })),
  );

  const settings = await getSettings();
  const question = turns.filter((t) => t.role === "user").at(-1)?.content;
  const answer = turns.filter((t) => t.role === "assistant").at(-1)?.content;
  if (question && answer) {
    await supabaseAdmin.from("training_pairs").insert({
      question,
      answer,
      source,
      status: settings.auto_approve ? "approved" : "pending",
      conversation_id: conv.id,
    });
  }
}
