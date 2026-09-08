/**
 * Daddy AI Sales Agent v2 - Sentiment Analysis, Lead Scoring & Smart Escalation
 *
 * Improvements:
 * - Better escalation reasons (specific, not generic)
 * - Lead scoring signals properly persisted
 * - AI-powered escalation detection for complex scenarios
 * - Smart human handoff for complaints, custom orders, returns
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
  score: number;
  emotions: string[];
  urgency: Urgency;
}

export interface LeadScoreResult {
  score: number;
  tier: LeadTier;
  signals: string[];
  shouldEscalate: boolean;
  escalationReason?: string;
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
// Sentiment Analysis
// ============================================================

export async function analyzeSentiment(
  message: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  apiKeyOverride?: string | null,
): Promise<SentimentResult> {
  // Fast path: use keyword analysis first — skip AI call for obvious cases
  // This saves ~1-2s latency and an AI call per message
  const keywordResult = keywordSentiment(message);
  
  // If keyword analysis gives a clear signal (not neutral), use it directly
  if (keywordResult.sentiment !== "neutral" || keywordResult.urgency !== "low") {
    return keywordResult;
  }
  
  // Only call AI for ambiguous/neutral messages where nuance matters
  // And only if conversation has some depth (skip for first messages)
  if (conversationHistory.length < 2) {
    return keywordResult;
  }

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content: `You are a sentiment analysis engine for a Bangladeshi e-commerce sales platform. Analyze the customer message and return ONLY a JSON object (no markdown, no explanation) with these fields:
{
  "sentiment": "very_negative" | "negative" | "neutral" | "positive" | "very_positive",
  "score": <number -1.0 to 1.0>,
  "emotions": [<array of detected emotions>],
  "urgency": "low" | "medium" | "high" | "critical"
}

Scoring guide:
- -1.0 to -0.6: very_negative (angry, threatening, demanding refund)
- -0.6 to -0.2: negative (frustrated, dissatisfied, complaining)
- -0.2 to 0.2: neutral (general inquiry, browsing)
- 0.2 to 0.6: positive (interested, asking follow-ups)
- 0.6 to 1.0: very_positive (ready to buy, excited)

Urgency:
- critical: explicit complaint, legal threat, refund demand, "I want to return", "this is broken"
- high: price negotiation, purchase intent, "I want to order", "how to pay"
- medium: product inquiry, comparison question
- low: casual browsing, general question

Context: Bangladeshi clothing/fashion e-commerce. Messages in Bengali, English, or Banglish.`,
    },
    ...conversationHistory.slice(-6).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: `Analyze: "${message}"` },
  ];

  try {
    const response = await chatComplete(prompt, undefined, apiKeyOverride);
    const text = typeof response === "string" ? response : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return keywordSentiment(message);

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      sentiment: validateSentiment(parsed.sentiment),
      score: clampScore(parsed.score, -1, 1),
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions.slice(0, 5) : [],
      urgency: validateUrgency(parsed.urgency),
    };
  } catch (err) {
    console.error("[SalesAgent] Sentiment analysis failed:", err);
    return keywordSentiment(message);
  }
}

function keywordSentiment(message: string): SentimentResult {
  const lower = message.toLowerCase();

  const veryNegative = ["refund", "ফেরত", "complain", "অভিযোগ", "terrible", "awful", "legal", "আইনি", "return", "ফেরান", "broken", "নষ্ট", "damaged"];
  const negative = ["problem", "সমস্যা", "wrong", "ভুল", "slow", "ধীর", "frustrated", "angry", "রাগ", "disappointed"];
  const positive = ["good", "ভালো", "like", "পছন্দ", "interested", "আগ্রহী", "nice", "thank", "ধন্যবাদ"];
  const veryPositive = ["buy", "কিনব", "order", "অর্ডার", "confirm", "নিশ্চিত", "payment", "বিকাশ", "nagad"];
  const urgent = ["urgent", "জরুরি", "asap", "immediately", "এখনই", "now"];

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
    if (urgency === "low") urgency = "high";
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
// Lead Scoring (improved with signal persistence)
// ============================================================

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
  let escalationReason: string | undefined;

  // 1. Sentiment contribution (0-25 points)
  const sentimentScore = Math.round(((sentimentResult.score + 1) / 2) * 25);
  score += sentimentScore;
  if (sentimentResult.score > 0.3) signals.push("positive_sentiment");
  if (sentimentResult.score > 0.6) signals.push("very_positive_sentiment");
  if (sentimentResult.score < -0.3) signals.push("negative_sentiment");
  if (sentimentResult.score < -0.6) signals.push("very_negative_sentiment");

  // 2. Purchase intent signals (0-30 points)
  const purchaseKeywords = [
    "কিনব", "buy", "order", "অর্ডার", "payment", "নাম্বার", "দিন",
    "bKash", "Nagad", "Rocket", "card", "checkout", "cart", "টাকা",
    "কত", "how much", "delivery", "ডেলিভারি", "ship", "confirm",
  ];
  const lowerMsg = currentMessage.toLowerCase();
  const purchaseMatches = purchaseKeywords.filter((k) => lowerMsg.includes(k.toLowerCase()));
  if (purchaseMatches.length > 0) {
    score += Math.min(30, purchaseMatches.length * 10);
    signals.push(`purchase_intent: ${purchaseMatches.join(", ")}`);
  }

  // 3. Conversation depth (0-20 points)
  const msgCount = conversationHistory.length;
  if (msgCount >= 2) { score += 5; signals.push("multi_turn"); }
  if (msgCount >= 4) { score += 5; signals.push("engaged"); }
  if (msgCount >= 6) { score += 5; signals.push("deep_engagement"); }
  if (msgCount >= 10) { score += 5; signals.push("highly_engaged"); }

  // 4. Product-specific inquiry (0-15 points)
  const productKeywords = ["স্টক", "stock", "আছে", "available", "size", "সাইজ", "color", "রং", "variant"];
  const productMatches = productKeywords.filter((k) => lowerMsg.includes(k.toLowerCase()));
  if (productMatches.length > 0) {
    score += Math.min(15, productMatches.length * 5);
    signals.push(`product_interest: ${productMatches.join(", ")}`);
  }

  // 5. Price engagement (0-10 points)
  const priceKeywords = ["দাম", "price", "discount", "ছাড়", "offer", "সেল", "sale"];
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
  const tier = scoreToTier(score);

  // 7. Smart escalation detection
  const { shouldEscalate, reason } = checkEscalationNeed(score, sentimentResult, conversationHistory, currentMessage);
  if (reason) escalationReason = reason;

  return { score, tier, signals, shouldEscalate, escalationReason };
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
  currentMessage: string,
): { shouldEscalate: boolean; reason?: string } {
  const lower = currentMessage.toLowerCase();

  // Complaint detection
  const complaintKeywords = ["complaint", "অভিযোগ", "refund", "ফেরত", "return", "ফেরান", "broken", "নষ্ট", "damaged", "defective", "ত্রুটি"];
  if (complaintKeywords.some(k => lower.includes(k))) {
    return { shouldEscalate: true, reason: "Customer complaint detected — needs human attention" };
  }

  // Return/refund request
  const returnKeywords = ["return", "ফেরত দিতে", "refund", "টাকা ফেরত", "exchange", "পরিবর্তন"];
  if (returnKeywords.some(k => lower.includes(k))) {
    return { shouldEscalate: true, reason: "Return/refund request — requires human processing" };
  }

  // Custom order request
  const customKeywords = ["custom", "কাস্টম", "bespoke", "নিজের ডিজাইন", "made to order", "সেলাই", "stitching", "alteration"];
  if (customKeywords.some(k => lower.includes(k))) {
    return { shouldEscalate: true, reason: "Custom order request — needs human consultation" };
  }

  // Bulk/wholesale inquiry
  const bulkKeywords = ["bulk", "বাল্ক", "wholesale", "পাইকারি", "একসাথে অনেক", "reseller", "ব্যবসায়ী"];
  if (bulkKeywords.some(k => lower.includes(k))) {
    return { shouldEscalate: true, reason: "Bulk/wholesale inquiry — needs sales team" };
  }

  // Payment issue
  const paymentKeywords = ["payment failed", "পেমেন্ট হয়নি", "bKash problem", "নগদ সমস্যা", "double charged", "দুইবার টাকা"];
  if (paymentKeywords.some(k => lower.includes(k))) {
    return { shouldEscalate: true, reason: "Payment issue reported — needs immediate attention" };
  }

  // Delivery complaint
  const deliveryKeywords = ["late delivery", "ডেলিভারি দেরি", "not received", "পাইনি", "wrong item", "ভুল পণ্য", "missing item"];
  if (deliveryKeywords.some(k => lower.includes(k))) {
    return { shouldEscalate: true, reason: "Delivery issue reported — needs logistics team" };
  }

  // Very negative sentiment
  if (sentiment.sentiment === "very_negative") {
    return { shouldEscalate: true, reason: "Customer frustrated — needs empathetic human response" };
  }

  // Critical urgency
  if (sentiment.urgency === "critical") {
    return { shouldEscalate: true, reason: "Critical urgency detected — time-sensitive issue" };
  }

  // High-value lead (score >= 75)
  if (score >= 75) {
    return { shouldEscalate: true, reason: `High-value lead (score: ${score}) — ready to convert` };
  }

  // Repeated negative messages
  const recentUserMsgs = history.slice(-4).filter((h) => h.role === "user");
  const negativeCount = recentUserMsgs.filter((h) => {
    const msg = h.content.toLowerCase();
    return ["problem", "সমস্যা", "wrong", "ভুল", "bad", "নষ্ট", "refund", "ফেরত"].some((w) => msg.includes(w));
  }).length;
  if (negativeCount >= 2) {
    return { shouldEscalate: true, reason: "Multiple negative messages — customer needs human support" };
  }

  return { shouldEscalate: false };
}

// ============================================================
// Human Escalation
// ============================================================

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
// Concurrency Manager
// ============================================================

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
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("usage_logs")
    .select("id", { count: "exact" })
    .eq("action", "ai_message")
    .gt("created_at", fiveMinAgo);

  return { allowed: (count ?? 0) < maxConcurrent, currentLoad: count ?? 0, maxConcurrent };
}

// ============================================================
// Main Pipeline
// ============================================================

export interface SalesPipelineResult {
  reply: string;
  sentiment: SentimentResult;
  leadScore: LeadScoreResult;
  escalated: boolean;
  escalationMessage?: string;
}

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

  // 2. Calculate lead score with signals
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

  // 4. Update lead score with proper signal persistence
  if (sessionId || conversationId) {
    const updateData: Record<string, unknown> = {
      score: leadScore.score,
      tier: leadScore.tier,
      signals: leadScore.signals,
      last_evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Find existing lead score by session_id (primary) or conversation_id
    let existingId: string | null = null;
    if (sessionId) {
      const { data } = await supabaseAdmin
        .from("lead_scores")
        .select("id")
        .eq("session_id", sessionId)
        .maybeSingle();
      existingId = data?.id ?? null;
    }
    if (!existingId && conversationId) {
      const { data } = await supabaseAdmin
        .from("lead_scores")
        .select("id")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      existingId = data?.id ?? null;
    }

    if (existingId) {
      await supabaseAdmin.from("lead_scores").update(updateData).eq("id", existingId);
    } else {
      await supabaseAdmin.from("lead_scores").insert({
        conversation_id: conversationId,
        session_id: sessionId,
        external_id: externalId,
        ...updateData,
      });
    }

    // Update session with latest score
    if (sessionId) {
      await supabaseAdmin
        .from("conversation_sessions")
        .update({ lead_score: leadScore.score, last_sentiment: sentiment.sentiment })
        .eq("id", sessionId);
    }
  }

  // 5. Check escalation with specific reason
  let escalated = false;
  let escalationMessage: string | undefined;

  if (leadScore.shouldEscalate) {
    const priority: EscalationPriority =
      sentiment.urgency === "critical" ? "urgent"
        : leadScore.score >= 75 ? "high"
          : sentiment.sentiment === "very_negative" ? "high"
            : "medium";

    const reason = leadScore.escalationReason || "General escalation — needs human review";

    const result = await escalateToHuman({
      conversationId, sessionId, externalId, channel,
      reason, priority,
      leadScore: leadScore.score,
      sentimentSummary: {
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        emotions: sentiment.emotions,
        urgency: sentiment.urgency,
        signals: leadScore.signals,
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
