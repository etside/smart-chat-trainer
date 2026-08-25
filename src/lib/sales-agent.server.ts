/**
 * Daddy AI Sales Agent - Sentiment Analysis, Lead Scoring & Human Diversion
 *
 * Handles:
 * - Real-time sentiment analysis per message
 * - Lead qualification scoring (0-100)
 * - Automatic human escalation when needed
 * - Concurrent conversation management (10-15 rush capacity)
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatComplete, type ChatMessage } from "./ai.server";

// ============================================================
// Types
// ============================================================

export type Sentiment = "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
export type LeadTier = "cold" | "warm" | "hot" | "qualified" | "escalated";
export type Urgency = "low" | "medium" | "high" | "critical";
export type EscalationPriority = "low" | "medium" | "high" | "urgent";
export type EscalationStatus = "pending" | "assigned" | "in_progress" | "resolved" | "dismissed";

export interface SentimentResult {
  sentiment: Sentiment;
  score: number; // -1.0 to 1.0
  emotions: string[];
  urgency: Urgency;
}

export interface LeadScoreResult {
  score: number; // 0-100
  tier: LeadTier;
  signals: string[];
  shouldEscalate: boolean;
}

export interface SalesAgentConfig {
  sentimentEnabled: boolean;
  leadScoreThreshold: number;
  autoEscalate: boolean;
  maxConcurrent: number;
  escalationWebhookUrl: string | null;
  humanTakeoverMessage: string;
}

// ============================================================
// Sentiment Analysis (AI-powered, no external dependency)
// ============================================================

/**
 * Analyze sentiment of a customer message using the AI model.
 * Uses a structured prompt to get consistent scoring.
 */
export async function analyzeSentiment(
  message: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  apiKeyOverride?: string | null,
): Promise<SentimentResult> {
  const prompt: ChatMessage[] = [
    {
      role: "system",
      content: `You are a sentiment analysis engine for a Bangladeshi e-commerce sales platform. Analyze the customer message and return ONLY a JSON object (no markdown, no explanation) with these fields:
{
  "sentiment": "very_negative" | "negative" | "neutral" | "positive" | "very_positive",
  "score": <number -1.0 to 1.0>,
  "emotions": [<array of detected emotions like "frustrated", "interested", "urgent", "confused", "satisfied", "angry", "excited", "hesitant">],
  "urgency": "low" | "medium" | "high" | "critical"
}

Scoring guide:
- -1.0 to -0.6: very_negative (angry, threatening, demanding refund)
- -0.6 to -0.2: negative (frustrated, dissatisfied, complaining)
- -0.2 to 0.2: neutral (general inquiry, browsing)
- 0.2 to 0.6: positive (interested, asking follow-ups, considering purchase)
- 0.6 to 1.0: very_positive (ready to buy, excited, confirming order)

Urgency:
- critical: explicit complaint, legal threat, refund demand, stock-out frustration
- high: price negotiation, purchase intent, time-sensitive request
- medium: product inquiry, comparison question
- low: casual browsing, general question

Context: This is a clothing/fashion e-commerce store in Bangladesh. Messages may be in Bengali, English, or Banglish.`,
    },
    ...conversationHistory.slice(-6).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    {
      role: "user",
      content: `Analyze this customer message: "${message}"`,
    },
  ];

  try {
    const response = await chatComplete(prompt, "mimo-v2.5", apiKeyOverride);
    const text = typeof response === "string" ? response : "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultSentiment();
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      sentiment: validateSentiment(parsed.sentiment),
      score: clampScore(parsed.score, -1, 1),
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions.slice(0, 5) : [],
      urgency: validateUrgency(parsed.urgency),
    };
  } catch (err) {
    console.error("[SalesAgent] Sentiment analysis failed:", err);
    // Fallback: keyword-based sentiment
    return keywordSentiment(message);
  }
}

/**
 * Fast keyword-based sentiment fallback (no AI call needed).
 */
function keywordSentiment(message: string): SentimentResult {
  const lower = message.toLowerCase();

  const veryNegative = ["refund", "ফেরত", "complain", "অভিযোগ", "terrible", "awful", "ইউনিটেড", "legal", "আইনি"];
  const negative = ["problem", "সমস্যা", "broken", "নষ্ট", "wrong", "ভুল", "slow", "ধীর", "frustrated", "angry", "রাগ"];
  const positive = ["good", "ভালো", "like", "পছন্দ", "interested", "আগ্রহী", "nice", "wonderful", "thank", "ধন্যবাদ"];
  const veryPositive = ["buy", "কিনব", "order", "অর্ডার", "confirm", "নিশ্চিত", "payment", "বিকাশ", "nagad", "rocket"];
  const urgent = ["urgent", "জরুরি", "asap", "immediately", "এখনই", "now", "এখন"];

  let score = 0;
  let sentiment: Sentiment = "neutral";
  let urgency: Urgency = "low";
  const emotions: string[] = [];

  if (urgent.some((w) => lower.includes(w))) {
    urgency = "high";
    emotions.push("urgent");
  }

  if (veryNegative.some((w) => lower.includes(w))) {
    score = -0.8;
    sentiment = "very_negative";
    emotions.push("frustrated");
  } else if (negative.some((w) => lower.includes(w))) {
    score = -0.4;
    sentiment = "negative";
    emotions.push("dissatisfied");
  } else if (veryPositive.some((w) => lower.includes(w))) {
    score = 0.8;
    sentiment = "very_positive";
    emotions.push("interested");
    urgency = "high";
  } else if (positive.some((w) => lower.includes(w))) {
    score = 0.4;
    sentiment = "positive";
    emotions.push("satisfied");
  }

  return { sentiment, score, emotions, urgency };
}

// ============================================================
// Lead Scoring
// ============================================================

/**
 * Calculate lead qualification score based on conversation signals.
 * Score 0-100, higher = more likely to convert.
 */
export async function calculateLeadScore(
  conversationId: string | null,
  sessionId: string | null,
  externalId: string | null,
  currentMessage: string,
  sentimentResult: SentimentResult,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<LeadScoreResult> {
  const signals: string[] = [];
  let score = 0;

  // 1. Sentiment contribution (0-25 points)
  const sentimentScore = Math.round(((sentimentResult.score + 1) / 2) * 25);
  score += sentimentScore;
  if (sentimentResult.score > 0.3) signals.push("positive_sentiment");
  if (sentimentResult.score > 0.6) signals.push("very_positive_sentiment");

  // 2. Purchase intent signals (0-30 points)
  const purchaseKeywords = [
    "কিনব", "buy", "order", "অর্ডার", "payment", "নাম্বার", "দিন",
    "bKash", "Nagad", "Rocket", "card", "checkout", "cart", "টাকা", "price",
    "কত", "how much", "delivery", "ডেলিভারি", "ship", "কতদিন",
  ];
  const lowerMsg = currentMessage.toLowerCase();
  const purchaseMatches = purchaseKeywords.filter((k) => lowerMsg.includes(k.toLowerCase()));
  if (purchaseMatches.length > 0) {
    score += Math.min(30, purchaseMatches.length * 10);
    signals.push(`purchase_intent: ${purchaseMatches.join(",")}`);
  }

  // 3. Conversation depth (0-20 points)
  const msgCount = conversationHistory.length;
  if (msgCount >= 2) score += 5;
  if (msgCount >= 4) score += 5;
  if (msgCount >= 6) score += 5;
  if (msgCount >= 10) score += 5;
  if (msgCount >= 2) signals.push("multi_turn_conversation");
  if (msgCount >= 6) signals.push("deep_engagement");

  // 4. Product-specific inquiry (0-15 points)
  const productKeywords = ["স্টক", "stock", "আছে", "available", "size", "সাইজ", "color", "রং", "variant", "ফিচার", "detail"];
  const productMatches = productKeywords.filter((k) => lowerMsg.includes(k.toLowerCase()));
  if (productMatches.length > 0) {
    score += Math.min(15, productMatches.length * 5);
    signals.push(`product_interest: ${productMatches.join(",")}`);
  }

  // 5. Price sensitivity (0-10 points) - high when discussing price = engaged
  const priceKeywords = ["দাম", "price", "discount", "ছাড়", "offer", "প্রমোশন", "সেল", "sale"];
  const priceMatches = priceKeywords.filter((k) => lowerMsg.includes(k.toLowerCase()));
  if (priceMatches.length > 0) {
    score += Math.min(10, priceMatches.length * 5);
    signals.push("price_engaged");
  }

  // 6. Negative signals reduce score
  if (sentimentResult.sentiment === "very_negative") score = Math.max(0, score - 20);
  if (sentimentResult.sentiment === "negative") score = Math.max(0, score - 10);

  // Clamp to 0-100
  score = Math.min(100, Math.max(0, score));

  // Determine tier
  const tier = scoreToTier(score);

  // Check escalation need
  const shouldEscalate = checkEscalationNeed(score, sentimentResult, conversationHistory);

  return { score, tier, signals, shouldEscalate };
}

function scoreToTier(score: number): LeadTier {
  if (score >= 80) return "qualified";
  if (score >= 60) return "hot";
  if (score >= 35) return "warm";
  return "cold";
}

function checkEscalationNeed(
  score: number,
  sentiment: SentimentResult,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): boolean {
  // Escalate on very negative sentiment
  if (sentiment.sentiment === "very_negative") return true;

  // Escalate on critical urgency
  if (sentiment.urgency === "critical") return true;

  // Escalate on high score (hot lead needs human)
  if (score >= 75) return true;

  // Escalate if repeated negative messages
  const recentUserMsgs = history.slice(-4).filter((h) => h.role === "user");
  const negativeCount = recentUserMsgs.filter((_, i) => {
    const lower = recentUserMsgs[i]?.content.toLowerCase() || "";
    return ["problem", "সমস্যা", "wrong", "ভুল", "bad", "নষ্ট", "refund", "ফেরত"].some((w) => lower.includes(w));
  }).length;
  if (negativeCount >= 2) return true;

  return false;
}

// ============================================================
// Human Diversion / Escalation
// ============================================================

/**
 * Create an escalation entry and notify webhook if configured.
 */
export async function escalateToHuman(params: {
  conversationId: string | null;
  sessionId: string | null;
  externalId: string | null;
  channel: string;
  reason: string;
  priority: EscalationPriority;
  leadScore: number;
  sentimentSummary: Record<string, unknown>;
}): Promise<{ escalationId: string; message: string }> {
  const { data: escalation } = await supabaseAdmin
    .from("escalation_queue")
    .insert({
      conversation_id: params.conversationId,
      session_id: params.sessionId,
      external_id: params.externalId,
      channel: params.channel,
      reason: params.reason,
      priority: params.priority,
      lead_score: params.leadScore,
      sentiment_summary: params.sentimentSummary,
      status: "pending",
    })
    .select("id")
    .single();

  // Update session escalation status
  if (params.sessionId) {
    await supabaseAdmin
      .from("conversation_sessions")
      .update({ escalation_status: "escalated" })
      .eq("id", params.sessionId);
  }

  // Fire webhook if configured
  const { data: settings } = await supabaseAdmin
    .from("agent_settings")
    .select("escalation_webhook_url")
    .eq("id", 1)
    .maybeSingle();

  if (settings?.escalation_webhook_url && escalation) {
    try {
      await fetch(settings.escalation_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "escalation",
          escalation_id: escalation.id,
          external_id: params.externalId,
          channel: params.channel,
          reason: params.reason,
          priority: params.priority,
          lead_score: params.leadScore,
          sentiment: params.sentimentSummary,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("[SalesAgent] Escalation webhook failed:", err);
    }
  }

  // Audit log
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: "system",
    action: "escalate_to_human",
    entity_type: "escalation_queue",
    entity_id: escalation?.id ?? null,
    metadata: {
      reason: params.reason,
      priority: params.priority,
      lead_score: params.leadScore,
      channel: params.channel,
    },
  }).catch(console.error);

  // Get takeover message
  const { data: agentSettings } = await supabaseAdmin
    .from("agent_settings")
    .select("human_takeover_message")
    .eq("id", 1)
    .maybeSingle();

  return {
    escalationId: escalation?.id ?? "",
    message: agentSettings?.human_takeover_message ?? "আমি এখন একজন মানুষের সাথে সংযুক্ত করছি। অনুগ্রহ করে একটু অপেক্ষা করুন।",
  };
}

// ============================================================
// Concurrent Conversation Manager
// ============================================================

/**
 * Check if we can accept a new conversation.
 */
export async function canAcceptConversation(): Promise<{
  allowed: boolean;
  currentLoad: number;
  maxConcurrent: number;
}> {
  const { data: settings } = await supabaseAdmin
    .from("agent_settings")
    .select("max_concurrent_conversations")
    .eq("id", 1)
    .maybeSingle();

  const maxConcurrent = settings?.max_concurrent_conversations ?? 15;

  // Count active conversations in last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("usage_logs")
    .select("id", { count: "exact" })
    .eq("action", "ai_message")
    .gt("created_at", fiveMinAgo);

  const currentLoad = count ?? 0;
  return {
    allowed: currentLoad < maxConcurrent,
    currentLoad,
    maxConcurrent,
  };
}

// ============================================================
// Main: Process Message Through Sales Pipeline
// ============================================================

export interface SalesPipelineResult {
  reply: string;
  sentiment: SentimentResult;
  leadScore: LeadScoreResult;
  escalated: boolean;
  escalationMessage?: string;
}

/**
 * Full sales pipeline: sentiment -> lead score -> escalation check -> reply.
 */
export async function processSalesMessage(params: {
  message: string;
  conversationId: string | null;
  sessionId: string | null;
  externalId: string | null;
  channel: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  generateReplyFn: (msg: string, hist: Array<{ role: "user" | "assistant"; content: string }>, versionId?: string | null) => Promise<{ reply: string; examples: Array<{ question: string; answer: string }> }>;
  apiKeyOverride?: string | null;
}): Promise<SalesPipelineResult> {
  const {
    message, conversationId, sessionId, externalId, channel,
    history, generateReplyFn, apiKeyOverride,
  } = params;

  // Check concurrency
  const load = await canAcceptConversation();
  if (!load.allowed) {
    return {
      reply: "আমরা এখন ব্যস্ত আছি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
      sentiment: { sentiment: "neutral", score: 0, emotions: [], urgency: "low" },
      leadScore: { score: 0, tier: "cold", signals: ["capacity_exceeded"], shouldEscalate: false },
      escalated: false,
    };
  }

  // 1. Analyze sentiment
  const sentiment = await analyzeSentiment(message, history, apiKeyOverride);

  // 2. Calculate lead score
  const leadScore = await calculateLeadScore(
    conversationId, sessionId, externalId, message, sentiment, history,
  );

  // 3. Save sentiment log
  await supabaseAdmin.from("sentiment_logs").insert({
    conversation_id: conversationId,
    session_id: sessionId,
    role: "user",
    content: message.slice(0, 1000),
    sentiment: sentiment.sentiment,
    sentiment_score: sentiment.score,
    emotions: sentiment.emotions,
    urgency: sentiment.urgency,
  }).catch(console.error);

  // 4. Update lead score
  if (conversationId || sessionId) {
    const updateData: Record<string, unknown> = {
      score: leadScore.score,
      tier: leadScore.tier,
      signals: leadScore.signals,
      last_evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert lead score
    const existingQuery = conversationId
      ? { conversation_id: conversationId }
      : { session_id: sessionId };

    const { data: existing } = await supabaseAdmin
      .from("lead_scores")
      .select("id")
      .eq(conversationId ? "conversation_id" : "session_id", conversationId || sessionId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("lead_scores")
        .update(updateData)
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("lead_scores").insert({
        ...existingQuery,
        external_id: externalId,
        ...updateData,
      });
    }

    // Update session with latest sentiment/score
    if (sessionId) {
      await supabaseAdmin
        .from("conversation_sessions")
        .update({
          lead_score: leadScore.score,
          last_sentiment: sentiment.sentiment,
        })
        .eq("id", sessionId);
    }
  }

  // 5. Check escalation
  let escalated = false;
  let escalationMessage: string | undefined;

  if (leadScore.shouldEscalate) {
    const priority: EscalationPriority =
      sentiment.urgency === "critical" ? "urgent"
        : leadScore.score >= 75 ? "high"
          : "medium";

    const reason = sentiment.sentiment === "very_negative"
      ? "Customer frustration detected"
      : leadScore.score >= 75
        ? `High-value lead (score: ${leadScore.score})`
        : sentiment.urgency === "critical"
          ? "Urgent customer need"
          : "Multiple negative signals";

    const result = await escalateToHuman({
      conversationId, sessionId, externalId, channel,
      reason, priority,
      leadScore: leadScore.score,
      sentimentSummary: {
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        emotions: sentiment.emotions,
        urgency: sentiment.urgency,
      },
    });

    escalated = true;
    escalationMessage = result.message;
  }

  // 6. Generate AI reply
  const { reply } = await generateReplyFn(message, history, apiKeyOverride);

  // 7. Save assistant sentiment
  await supabaseAdmin.from("sentiment_logs").insert({
    conversation_id: conversationId,
    session_id: sessionId,
    role: "assistant",
    content: reply.slice(0, 1000),
    sentiment: "neutral",
    sentiment_score: 0,
    emotions: [],
    urgency: "low",
  }).catch(console.error);

  return {
    reply: escalated ? `${reply}\n\n${escalationMessage}` : reply,
    sentiment,
    leadScore,
    escalated,
    escalationMessage,
  };
}

// ============================================================
// Helpers
// ============================================================

function validateSentiment(s: string): Sentiment {
  const valid: Sentiment[] = ["very_negative", "negative", "neutral", "positive", "very_positive"];
  return valid.includes(s as Sentiment) ? (s as Sentiment) : "neutral";
}

function validateUrgency(u: string): Urgency {
  const valid: Urgency[] = ["low", "medium", "high", "critical"];
  return valid.includes(u as Urgency) ? (u as Urgency) : "low";
}

function clampScore(score: number, min: number, max: number): number {
  if (typeof score !== "number" || isNaN(score)) return 0;
  return Math.min(max, Math.max(min, score));
}

function getDefaultSentiment(): SentimentResult {
  return { sentiment: "neutral", score: 0, emotions: [], urgency: "low" };
}
