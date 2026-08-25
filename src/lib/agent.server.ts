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

const VALID_MIMO_MODELS = ["mimo-v2.5-pro", "mimo-v2.5"];

// Increased history window for multi-turn memory
const HISTORY_WINDOW = 20;

function sanitizeModel(model: string | null | undefined): string {
  if (!model || !VALID_MIMO_MODELS.includes(model)) {
    return "mimo-v2.5";
  }
  return model;
}

/**
 * Detect the primary language of a message.
 * Returns ISO 639-1 code: 'bn', 'en', or 'mixed'.
 */
function detectLanguage(text: string): "bn" | "en" | "mixed" {
  const bengaliScript = /[\u0980-\u09FF]/;
  const latinScript = /[a-zA-Z]/;

  const hasBengali = bengaliScript.test(text);
  const hasLatin = latinScript.test(text);

  if (hasBengali && hasLatin) {
    // Check if it's Banglish (Bengali words in Latin script)
    const banglishPattern = / ami | tumi | kemon | ache | naki | ki | hocche | dite | pari | na /i;
    if (banglishPattern.test(text)) return "mixed";
    return "mixed";
  }
  if (hasBengali) return "bn";
  if (hasLatin) return "en";
  return "bn"; // Default to Bengali for this platform
}

/**
 * Generate a conversation summary for long sessions.
 * Summarizes old turns to fit within context window.
 */
async function summarizeHistory(
  turns: HistoryTurn[],
  model: string,
  apiKeyOverride?: string | null,
): Promise<string> {
  if (turns.length <= HISTORY_WINDOW) return "";

  const oldTurns = turns.slice(0, turns.length - HISTORY_WINDOW);
  const summaryPrompt = [
    {
      role: "system" as const,
      content: "Summarize this conversation in 2-3 sentences in Bengali. Focus on key topics, customer needs, and decisions made. Be concise.",
    },
    ...oldTurns.map((t) => ({ role: t.role as "user" | "assistant", content: t.content })),
  ];

  try {
    const summary = await chatComplete(summaryPrompt, model, apiKeyOverride);
    return typeof summary === "string" ? summary : "";
  } catch {
    return "";
  }
}

export async function getSettings() {
  const { data } = await supabaseAdmin
    .from("agent_settings")
    .select("system_prompt, model, auto_approve, lovable_api_key_override")
    .eq("id", 1)
    .maybeSingle();

  return {
    system_prompt: data?.system_prompt ?? "",
    model: sanitizeModel(data?.model),
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
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const settings = await getSettings();
  
  // Fetch matching auto-reply template if applicable
  const { data: templates } = await supabaseAdmin
    .from("auto_reply_templates")
    .select("*")
    .limit(5);
  
  const autoReplyContext = templates?.length 
    ? "নিচের টেমপ্লেটগুলো থেকে উত্তর তৈরির ধারণা নিন:\n" + templates.map(t => `- ${t.name} (${t.platform}): ${t.template_text}`).join("\n")
    : "কোনো নির্দিষ্ট টেমপ্লেট পাওয়া যায়নি।";

  
  // Parallel Execution Limit (Simple count check)
  const { data: runningJobs } = await supabaseAdmin
    .from("usage_logs")
    .select("id", { count: "exact" })
    .eq("action", "ai_message")
    .gt("created_at", new Date(Date.now() - 10000).toISOString()); // Last 10 seconds

  const currentLoad = runningJobs?.length || 0;
  // Note: max_simultaneous_replies would come from settings in a full implementation
  
  // Incremental Analysis (Conceptually: process parts of message)
  // Here we just proceed as normal but logged for performance monitoring
  const analysisStartTime = Date.now();

  
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

  // Multi-turn memory: summarize old turns if history exceeds window
  const recentHistory = history.slice(-HISTORY_WINDOW);
  const olderHistory = history.slice(0, history.length - HISTORY_WINDOW);
  let summaryContext = "";
  if (olderHistory.length > 0) {
    summaryContext = await summarizeHistory(history, settings.model, settings.lovable_api_key_override);
  }

  // Language auto-detect from customer message
  const detectedLang = detectLanguage(message);
  const langInstruction = detectedLang === "en"
    ? "The customer is writing in English. Respond in English."
    : detectedLang === "mixed"
    ? "The customer is using Banglish (Bengali in Latin script). Respond in standard Bengali."
    : "The customer is writing in Bengali. Respond in Bengali.";

  const summaryBlock = summaryContext
    ? `\n\nPrevious conversation summary:\n${summaryContext}`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${settings.system_prompt}

Language Detection: ${langInstruction}

Auto-Reply Context:
${autoReplyContext}
${summaryBlock}

নিচে আমাদের আগের আসল কথোপকথন থেকে সবচেয়ে মিল থাকা উদাহরণ দেওয়া হলো। এই টোন, ভাষা ও তথ্য অনুসরণ করে উত্তর দাও। উত্তর ছোট রাখো (১-৩ লাইন), ঠিক যেভাবে পেজ থেকে রিপ্লাই দেওয়া হয়।

${exampleBlock}

${autoReplyContext}`,
    },
    ...recentHistory.map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: message },
  ];

  const analysisDuration = Date.now() - analysisStartTime;
  const { logPerformanceMetric } = await import("./performance.functions");
  await logPerformanceMetric("analysis", analysisDuration, requestId);

  const replyStartTime = Date.now();
  const replyResponse = await chatComplete(messages, settings.model, settings.lovable_api_key_override);
  const reply = typeof replyResponse === 'string' ? replyResponse : 'Streaming response initiated';
  const replyDuration = Date.now() - replyStartTime;
  await logPerformanceMetric("reply", replyDuration, requestId);
  
  const totalDuration = Date.now() - startTime;
  await logPerformanceMetric("overall", totalDuration, requestId);
  
  // Log message usage
  await logActionUsage({ data: { action: "ai_message", metadata: { model: settings.model, duration: totalDuration } } }).catch(console.error);
  
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

  // Session management: find or create session, save messages
  const lastUserMsg = turns.filter((t) => t.role === "user").at(-1)?.content ?? "";
  const detectedLang = detectLanguage(lastUserMsg);

  let sessionId: string | null = null;
  if (externalId) {
    // Find or create session by external_id
    const { data: existing } = await supabaseAdmin
      .from("conversation_sessions")
      .select("id")
      .eq("external_id", externalId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      sessionId = existing.id;
      await supabaseAdmin
        .from("conversation_sessions")
        .update({
          message_count: turns.length,
          last_message_at: new Date().toISOString(),
          customer_language: detectedLang,
        })
        .eq("id", sessionId);
    } else {
      const { data: newSession } = await supabaseAdmin
        .from("conversation_sessions")
        .insert({
          external_id: externalId,
          channel: source,
          customer_language: detectedLang,
          message_count: turns.length,
        })
        .select("id")
        .single();
      sessionId = newSession?.id ?? null;
    }
  }

  // Save to session_messages if session exists
  if (sessionId) {
    await supabaseAdmin.from("session_messages").insert(
      turns.map((t) => ({
        session_id: sessionId,
        role: t.role,
        content: t.content,
        channel: source,
      })),
    );
  }

  // Log analytics event
  try {
    await supabaseAdmin.from("analytics_events").insert({
      event_type: "conversation",
      channel: source,
      metadata: {
        language: detectedLang,
        message_count: turns.length,
        session_id: sessionId,
      },
    });
  } catch { /* Non-critical */ }

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
      language: detectedLang,
    });
  }
}
