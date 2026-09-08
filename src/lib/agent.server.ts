import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatComplete, type ChatMessage } from "./ai.server";
import { logActionUsage } from "./usage.functions";
import { checkChatGuardrails, getChatGuardrailsPrompt, getFallbackReply } from "./skills/chat-guardrails";

// ─── Types ──────────────────────────────────────────────────────────────────

export type HistoryTurn = { role: "user" | "assistant"; content: string; metadata?: Record<string, any> | null };

export interface ProductCard {
  id: number;
  name: string;
  price: number;
  currency: string;
  image_url: string;
  product_url: string;
  availability: string;
  stock: number;
  category: string;
  brand: string;
  short_description: string;
  variants: any[];
  sizes: string[];
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const stockCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5;
const RATE_LIMIT_MS = 2000;
const lastLookup: Record<string, number> = {};

// Training pairs cache (10 min TTL)
let trainingCache: { pairs: any[]; at: number } | null = null;
const TRAINING_CACHE_TTL = 1000 * 60 * 30; // 30 min — training pairs don't change that fast

async function getCachedTrainingPairs(): Promise<any[]> {
  const now = Date.now();
  if (trainingCache && now - trainingCache.at < TRAINING_CACHE_TTL) {
    return trainingCache.pairs;
  }
  const { data } = await supabaseAdmin
    .from("training_pairs")
    .select("question, answer, status")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(500);
  const pairs = data ?? [];
  trainingCache = { pairs, at: now };
  return pairs;
}

// ─── Product detection keywords ──────────────────────────────────────────────

const PRODUCT_QUERY_PATTERN = /দাম|স্টক|আছে|নেই|কত|price|stock|available|buy|কিনব|order|অর্ডার|দেখান|show|product|পণ্য|কালেকশন|collection|dress|shirt|pant|bag|shoe|ব্যাগ|জামা|শার্ট|প্যান্ট|পোশাক|fashion|ফ্যাশন|size|সাইজ|color|রঙ|রং|variant/i;

// ─── Bengali ↔ English product term mapping ─────────────────────────────
// Customers query in Bengali but products are stored in English.
// This mapping enables cross-language product search.
const BN_EN_PRODUCT_MAP: Record<string, string[]> = {
  "পাঞ্জাবি": ["panjabi", "punjabi", "kurta", "kurti"],
  "পাঞজাবি": ["panjabi", "punjabi", "kurta"],
  "কুর্তি": ["kurti", "kurta", "tunic"],
  "কুর্তা": ["kurta", "kurti"],
  "শার্ট": ["shirt"],
  "শার্ট": ["shirt"],
  "টি-শার্ট": ["t-shirt", "tshirt", "tee"],
  "টি শার্ট": ["t-shirt", "tshirt"],
  "প্যান্ট": ["pant", "pants", "trouser", "trousers"],
  "পেন্ট": ["pant", "pants"],
  "জিন্স": ["jeans", "denim", " denim"],
  "ড্রেস": ["dress", "frock"],
  "জামা": ["dress", "frock", "clothing"],
  "পোশাক": ["dress", "clothing", "outfit"],
  "ব্যাগ": ["bag"],
  "জুতা": ["shoe", "shoes", "footwear"],
  "স্যান্ডেল": ["sandal", "sandals"],
  "কম্বো": ["combo"],
  "কম্বো": ["combo"],
  "সেট": ["set", "combo"],
  "তিন পিস": ["3 piece", "three piece", "3piece"],
  "দুই পিস": ["2 piece", "two piece", "2piece"],
  "সালোয়ার": ["salwar", "shalwar"],
  "কামিজ": ["kameez", "kamiz"],
  "দুপাটা": ["dupatta", "duppata"],
  "ওড়না": ["dupatta"],
  "স্কার্ফ": ["scarf"],
  "হিজাব": ["hijab"],
  "ব্লাউজ": ["blouse"],
  "পেটিকোট": ["petticoat"],
  "নাইটি": ["nighty", "night dress"],
  "গাউন": ["gown"],
  "টপ": ["top", "tops"],
  "ব্লাউজ": ["blouse"],
  "লুঙ্গি": ["lungi"],
  "গামছা": ["gamcha", "towel"],
  "পাঞ্জাবি সেট": ["panjabi set", "kurta set"],
  "ফুল স্লিভ": ["full sleeve"],
  "হাফ স্লিভ": ["half sleeve"],
  "সলিড": ["solid"],
  "প্রিন্টেড": ["printed", "print"],
  "ফ্লোরাল": ["floral"],
  "স্ট্রাইপ": ["stripe", "striped"],
  "চেক": ["check", "checked"],
  "কটন": ["cotton"],
  "লিনেন": ["linen"],
  "রেশম": ["silk"],
  "জর্জেট": ["georgette"],
  "শিফন": ["chiffon"],
  "ক্রেপ": ["crepe"],
};

// Extended search terms: expands a Bengali query into English alternatives
function expandProductSearchTerms(query: string): string[] {
  const terms: string[] = [query];
  const lower = query.toLowerCase().trim();
  
  // Direct mapping
  for (const [bn, enList] of Object.entries(BN_EN_PRODUCT_MAP)) {
    if (lower.includes(bn.toLowerCase())) {
      terms.push(...enList);
    }
  }
  
  // Also check if the query itself is an English product term
  // (customer might type in English too)
  const commonProducts = ["panjabi", "kurti", "shirt", "pant", "jeans", "dress", "combo", "bag", "shoe"];
  for (const p of commonProducts) {
    if (lower.includes(p)) {
      terms.push(p);
    }
  }
  
  return [...new Set(terms)];
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getFreshStockData(query: string) {
  const now = Date.now();
  if (lastLookup[query] && now - lastLookup[query] < RATE_LIMIT_MS) return stockCache[query]?.data;
  if (stockCache[query] && now - stockCache[query].timestamp < CACHE_TTL) return stockCache[query].data;
  lastLookup[query] = now;

  const { data } = await supabaseAdmin
    .from("training_pairs").select("answer")
    .ilike("question", `%${query}%`).eq("source", "api_sync").maybeSingle();

  if (data) stockCache[query] = { data: data.answer, timestamp: now };
  return data?.answer;
}

/**
 * Search product_catalogue by keyword — returns up to `limit` product cards.
 */
export async function searchProductCards(query: string, limit = 3): Promise<ProductCard[]> {
  // Expand Bengali query to English search terms
  const searchTerms = expandProductSearchTerms(query);
  
  // Build OR filter for all expanded terms
  const orFilters = searchTerms.flatMap(term => [
    `name.ilike.%${term}%`,
    `category.ilike.%${term}%`,
    `brand.ilike.%${term}%`,
    `short_description.ilike.%${term}%`,
  ]).join(",");

  // Try in-stock first
  const { data } = await supabaseAdmin
    .from("product_catalogue")
    .select("id, name, price, currency, image_url, product_url, availability, stock, category, brand, short_description, variants, sizes")
    .or(orFilters)
    .eq("availability", "in stock")
    .order("stock", { ascending: false })
    .limit(limit);

  if (data && data.length > 0) {
    return data.map(p => ({
      ...p,
      variants: typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants ?? []),
      sizes: p.sizes ?? [],
    })) as ProductCard[];
  }

  // Fallback: search all (including out-of-stock) with expanded terms
  const { data: all } = await supabaseAdmin
    .from("product_catalogue")
    .select("id, name, price, currency, image_url, product_url, availability, stock, category, brand, short_description, variants, sizes")
    .or(orFilters)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (all ?? []).map(p => ({
    ...p,
    variants: typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants ?? []),
    sizes: p.sizes ?? [],
  })) as ProductCard[];
}

/**
 * Extract a product search term from a natural language query.
 */
function extractProductTerm(message: string): string {
  // Remove common question words, keep the meaningful noun phrase
  let term = message
    .replace(/এর দাম কত|দাম কত|স্টকে আছে কি|আছে কি|সম্পর্কে জানান|কি আছে|দেখান|কিনতে চাই/g, "")
    .replace(/how much|what is the price|is it available|show me|i want to buy/gi, "")
    .replace(/[?।!]/g, "")
    .trim()
    .slice(0, 60);
  
  // If term is Bengali, also return the English equivalent for search
  const expanded = expandProductSearchTerms(term);
  if (expanded.length > 1) {
    // Return the first English term as the primary search term
    return expanded[1]; // First English mapping
  }
  return term;
}

const HISTORY_BUDGET_CHARS = 16_000; // total budget for all history turns (≈4–5k tokens)
const MAX_TURN_CHARS = 1_600;        // per-turn cap — truncate huge single messages
const COMPACTION_THRESHOLD = 20;     // compact when history exceeds this many turns

/**
 * Summarize older conversation turns into a compact context block.
 * Keeps the most recent `keepRecent` turns verbatim and summarizes the rest.
 */
async function compactHistory(history: HistoryTurn[], keepRecent = 10): Promise<HistoryTurn[]> {
  if (history.length <= keepRecent) return history;

  const older = history.slice(0, history.length - keepRecent);
  const recent = history.slice(history.length - keepRecent);

  // Build a compact summary of older turns
  const summaryParts: string[] = [];
  let userTopics: string[] = [];

  for (const turn of older) {
    if (turn.role === "user") {
      // Extract key topics/questions from user messages
      const topic = turn.content
        .replace(/[؟?!।,.\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);
      if (topic.length > 5) userTopics.push(topic);
    }
  }

  if (userTopics.length > 0) {
    // Keep only unique-ish topics (deduplicate by first 40 chars)
    const seen = new Set<string>();
    const unique = userTopics.filter(t => {
      const key = t.slice(0, 40).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);

    summaryParts.push(`Previous conversation topics: ${unique.join("; ")}`);
  }

  // Extract last product discussed
  const lastProductTurn = older.reverse().find(t =>
    t.role === "assistant" && /৳|price|দাম|product|প্রোডাক্ট/i.test(t.content)
  );
  if (lastProductTurn) {
    const priceMatch = lastProductTurn.content.match(/৳\s*[\d,]+/);
    if (priceMatch) {
      summaryParts.push(`Last discussed price context: ${priceMatch[0]}`);
    }
  }

  const summary = summaryParts.join("\n") || "Previous conversation context preserved.";

  return [
    { role: "assistant" as const, content: `[Context summary: ${summary}]`, metadata: { is_compaction: true } },
    ...recent,
  ];
}

/**
 * Fit conversation history into a fixed character budget, newest first.
 * For long conversations (>20 turns), summarizes older turns into a compact
 * context block to preserve important information while staying within budget.
 */
async function fitHistoryInBudget(history: HistoryTurn[]): Promise<HistoryTurn[]> {
  if (history.length === 0) return [];

  // For long conversations, compact older turns first
  let processedHistory = history;
  if (history.length > COMPACTION_THRESHOLD) {
    try {
      processedHistory = await compactHistory(history);
    } catch (err: any) {
      console.warn("[agent] history compaction failed, using raw:", err?.message);
    }
  }

  const fitted: HistoryTurn[] = [];
  let used = 0;
  // Walk newest → oldest so the most recent turns are always kept verbatim.
  for (let i = processedHistory.length - 1; i >= 0; i--) {
    const turn = processedHistory[i];
    let content = turn.content;
    if (content.length > MAX_TURN_CHARS) {
      content = content.slice(0, MAX_TURN_CHARS) + "…";
    }
    if (used + content.length > HISTORY_BUDGET_CHARS) break;
    fitted.unshift({ ...turn, content });
    used += content.length;
  }
  return fitted;
}

// Model is provider-agnostic now — pass it through as configured in
// agent_settings (chatComplete resolves the default when empty).
function sanitizeModel(model: string | null | undefined): string | undefined {
  return model || undefined;
}

export function detectLanguage(text: string): "bn" | "en" | "mixed" {
  const hasBengali = /[\u0980-\u09FF]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasBengali && hasLatin) return "mixed";
  if (hasBengali) return "bn";
  if (hasLatin) return "en";
  return "bn";
}

export async function getSettings() {
  const { data } = await supabaseAdmin
    .from("agent_settings")
    .select("system_prompt, model, auto_approve, lovable_api_key_override")
    .eq("id", 1).maybeSingle();
  return {
    system_prompt: data?.system_prompt ?? "",
    model: sanitizeModel(data?.model),
    auto_approve: data?.auto_approve ?? false,
    lovable_api_key_override: data?.lovable_api_key_override,
  };
}

// ── In-process example cache (LRU-lite, 200 entries, 5min TTL) ────────────
const _exampleCache = new Map<string, { data: any[]; ts: number }>();
const EXAMPLE_CACHE_TTL = 5 * 60 * 1000; // 5 min for example cache
const EXAMPLE_CACHE_MAX = 200;

// ── Intent classification ───────────────────────────────────────────────────
// Classifies a customer message so RAG only pulls training pairs that answer
// the SAME kind of question. Fixes "price question → ordering-template answer"
// mismatches caused by pure string-similarity matching.
export type Intent =
  | "price"
  | "size"
  | "stock"
  | "delivery"
  | "order"
  | "material"
  | "product"
  | "general";

const INTENT_PATTERNS: Array<{ intent: Intent; re: RegExp }> = [
  { intent: "price", re: /দাম|কত করে|কত টাকা|কতো|দাম কত|price|cost|rate|charge.*কত|কত\b.*৳/i },
  { intent: "size", re: /সাইজ|মাপ|size|fit|measurement|কোমর|হাই ওয়েস্ট|high waist|কোন সাইজ|কোন মাপ/i },
  { intent: "delivery", re: /ডেলিভারি|delivery|শিপিং|shipping|কুরিয়ার|courier|ঢাকার বাইরে|outside dhaka|শিপ|ship/i },
  { intent: "stock", re: /স্টক|স্টকে|stock|আছে কি|পাওয়া যায়|available|নেই কি|ইন স্টক|in stock|উপলব্ধ/i },
  { intent: "material", re: /ফেব্রিক|fabric|মেটেরিয়াল|material|কাপড়|কাপর|cloth|গ্যাবার্ডিন|gabardine|কটন|cotton|জিন্স|denim/i },
  { intent: "order", re: /অর্ডার|order|কিনব|কেনা|কিনতে|বিকাশ|bkash|নগদ|নগদে|buy|purchase|এডভান্স|advance/i },
  { intent: "product", re: /প্রোডাক্ট|product|পণ্য|কালেকশন|collection|dress|shirt|pant|bag|shoe|ব্যাগ|জামা|শার্ট|প্যান্ট|পোশাক|item|আইটেম|ছবি|picture|photo|screenshot|লিংক|link/i },
];

const INTENT_FALLBACK: Intent = "general";

export function detectIntent(message: string): Intent {
  const text = message.toLowerCase();
  for (const { intent, re } of INTENT_PATTERNS) {
    if (re.test(text)) return intent;
  }
  return INTENT_FALLBACK;
}

// Minimum similarity for a training pair to be considered a confident match.
// Below this we refuse to inject the example — better to let the LLM answer
// fresh than to feed it an off-topic example.
const RAG_MIN_SCORE = 0.25;

async function classifyExistingPairs(): Promise<void> {
  // One-time background backfill: tag approved pairs that still have intent='general'
  // based on their question text, so the intent filter has data to match against.
  try {
    const { data: pairs } = await supabaseAdmin
      .from("training_pairs")
      .select("id, question")
      .eq("status", "approved")
      .eq("intent", "general")
      .limit(2000);
    if (!pairs?.length) return;
    for (const p of pairs) {
      const intent = detectIntent(p.question ?? "");
      if (intent === "general") continue;
      await supabaseAdmin
        .from("training_pairs")
        .update({ intent })
        .eq("id", p.id)
        .catch(() => {});
    }
  } catch {}
}

// Fire-and-forget backfill on module load (idempotent, safe).
void classifyExistingPairs();

export async function findExamples(query: string, limit = 8): Promise<Array<{ question: string; answer: string; score: number }>> {
  const intent = detectIntent(query);
  const key = `${intent}:${query.slice(0, 100)}:${limit}`;
  const cached = _exampleCache.get(key);
  if (cached && Date.now() - cached.ts < EXAMPLE_CACHE_TTL) return cached.data;

  const { data } = await supabaseAdmin.rpc('search_training_pairs', {
    _query: query.slice(0, 300),
    _intent: intent,
    _limit: limit,
    _min_score: RAG_MIN_SCORE,
  });
  const result = (data ?? []) as Array<{ question: string; answer: string; score: number }>;

  // Evict oldest if at cap
  if (_exampleCache.size >= EXAMPLE_CACHE_MAX) {
    const firstKey = _exampleCache.keys().next().value;
    if (firstKey) _exampleCache.delete(firstKey);
  }
  _exampleCache.set(key, { data: result, ts: Date.now() });
  return result;
}

// ─── Main: generateReply ──────────────────────────────────────────────────────

export async function generateReply(
  message: string,
  history: HistoryTurn[] = [],
  versionId?: string | null,
): Promise<{ reply: string; examples: Array<{ question: string; answer: string }>; product_cards?: ProductCard[] }> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const settings = await getSettings();

  // ── Auto-reply templates ──────────────────────────────────────────────
  const { data: templates } = await supabaseAdmin.from("auto_reply_templates").select("name, platform, template_text").limit(3); // reduced from 5
  const autoReplyContext = templates?.length
    ? "নিচের টেমপ্লেটগুলো থেকে উত্তর তৈরির ধারণা নিন:\n" + templates.map(t => `- ${t.name} (${t.platform}): ${t.template_text}`).join("\n")
    : "কোনো নির্দিষ্ট টেমপ্লেট পাওয়া যায়নি।";

  // ── Product card detection ───────────────────────────────────────────
  const isProductQuery = PRODUCT_QUERY_PATTERN.test(message);
  let product_cards: ProductCard[] | undefined;

  if (isProductQuery) {
    const searchTerm = extractProductTerm(message);
    if (searchTerm.length > 2) {
      product_cards = await searchProductCards(searchTerm, 3);
    }
    // Fallback: if no specific product found, show popular/recent items
    if (!product_cards || product_cards.length === 0) {
      const { data: popular } = await supabaseAdmin
        .from("product_catalogue")
        .select("id, name, price, currency, image_url, product_url, availability, stock, category, brand, short_description, variants, sizes")
        .eq("availability", "in stock")
        .order("updated_at", { ascending: false })
        .limit(3);
      if (popular?.length) {
        product_cards = popular.map(p => ({
          ...p,
          variants: typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants ?? []),
          sizes: p.sizes ?? [],
        }));
      }
    }
  }

  // ── Exact-match shortcut (zero AI cost) ─────────────────────
  const allPairs = await getCachedTrainingPairs();
  const normalizedMsg = message.trim().toLowerCase();
  const exactMatch = allPairs.find(
    (p: any) => p.question?.trim().toLowerCase() === normalizedMsg
  );
  if (exactMatch?.answer) {
    console.log("[agent] exact-match hit — skipping AI call");
    await logActionUsage({ data: { action: "exact_match_reply", metadata: { saved_ai_call: true } } }).catch(console.error);
    return {
      reply: exactMatch.answer,
      examples: [],
      product_cards: product_cards && product_cards.length > 0 ? product_cards : undefined,
    };
  }

  // ── RAG examples ──────────────────────────────────────────────────────
  const examples = await findExamples(message);
  const exampleBlock = examples.length
    ? examples.map((e, i) => `উদাহরণ ${i + 1}:\nকাস্টমার: ${e.question}\nআমরা: ${e.answer}`).join("\n\n")
    : "কোনো মিল পাওয়া যায়নি।";

  // ── Product card context for AI ───────────────────────────────────────
  let productContext = "";
  if (product_cards && product_cards.length > 0) {
    productContext = "\n\nপ্রাসঙ্গিক পণ্যসমূহ:\n" + product_cards.map(p =>
      `• ${p.name} — ৳${p.price} — ${p.availability === "in stock" ? `স্টকে আছে (${p.stock}টি)` : "স্টকে নেই"}${p.image_url ? `\n  ছবি: ${p.image_url}` : ""}${p.product_url ? `\n  লিংক: ${p.product_url}` : ""}${p.sizes?.length ? `\n  সাইজ: ${p.sizes.join(", ")}` : ""}`
    ).join("\n");
    productContext += "\n\nকাস্টমারকে পণ্যের ছবি/লিংক দাও এবং অর্ডার করতে সাহায্য করো।";
  }

  // ── History budget (deterministic char cap — newest turns win) ───────
  const fittedHistory = await fitHistoryInBudget(history);

  // ── Language detection ────────────────────────────────────────────────
  const detectedLang = detectLanguage(message);
  const langInstruction = detectedLang === "en"
    ? "The customer is writing in English. Respond in English."
    : detectedLang === "mixed"
      ? "The customer is using Banglish. Respond in standard Bengali."
      : "The customer is writing in Bengali. Respond in Bengali.";

  const summaryBlock = ""; // legacy slot — history is budget-truncated instead

  // ── Personality block: warm, human boutique salesperson vibe ────────────
  // Makes replies sound like a friendly Bengali fashion boutique seller,
  // not a chatbot. Keeps the Wear Impressive store voice warm and salesy.
  const personalityBlock = `PERSONALITY & VIBE (IMPORTANT):
You are Ritu, a friendly, warm salesperson at a Bangladeshi fashion boutique. Reply like you're chatting with a valued customer, not a call center bot.
- Be warm, polite, and genuinely helpful. Address the customer naturally (use "আপনি").
- Sound excited about the products — recommend genuinely, like a friend showing off their favorite pieces.
- Keep replies SHORT: 1-2 sentences max. Bengali customers prefer quick, direct answers.
- Use tasteful emoji sparingly (1-2 per reply max) — shopping bag, dress, sparkle.
- Ask a soft follow-up question to keep the conversation alive (e.g. "কোন সাইজ লাগবে?", "রঙ পছন্দ কোনটা?").
- If the customer wants to order, guide them warmly toward the next step.
- Never be pushy or robotic. Match the customer's language (Bengali / Banglish / English).
- Never invent prices, stock, or products you're not sure about.

CRITICAL RULES FOR PRODUCT RESPONSES:
When you recommend or identify a product, you MUST respond with valid JSON (not plain text) using this format:

For a SINGLE product recommendation:
{"messages":[{"type":"text","text":"Your conversational message here"},{"type":"product_card","product_card":{"title":"Product Name","price":1290,"currency":"৳","image_url":"https://...","availability":"In Stock","features":["Sizes: S/M/L/XL","Cash on Delivery"],"product_url":"https://...","product_id":"123"}}]}

For MULTIPLE product recommendations (up to 3):
{"messages":[{"type":"text","text":"Your conversational message"},{"type":"carousel","cards":[{"title":"Product 1","price":1290,"currency":"৳","image_url":"https://...","availability":"In Stock","features":["Sizes: S/M/L"],"product_url":"https://...","product_id":"1"},{"title":"Product 2","price":990,"currency":"৳","image_url":"https://...","availability":"In Stock","features":["Sizes: M/L/XL"],"product_url":"https://...","product_id":"2"}]}]}

For non-product messages (greetings, general questions, order flow), respond with plain text as usual.

RULES:
1. When customer asks about a product, price, or sends a product image — ALWAYS use the JSON format above.
2. The text message should be SHORT (1-2 sentences, warm and conversational).
3. Include REAL product data from the context — never invent prices or products.
4. The image_url MUST be the actual catalogue image URL.
5. The product_url MUST be the actual product link.
6. Include stock status and available sizes in features array.
7. If out of stock, still show the product but note "Out of Stock" in availability, and suggest alternatives.
8. For image-based queries, first describe what you see briefly, then show matching products.
9. When customer asks "Price?" or "দাম কত?" without specifying, show 2-3 popular items.
10. Keep the conversational text under 50 words. Let the product cards speak for themselves.
11. Always end the text with a question to keep conversation going.
12. For general non-product messages, respond with plain text only (no JSON).

ORDER FLOW:
When customer wants to order:
1. Confirm product + size + color
2. Ask for delivery address
3. Mention payment (COD available)
4. Give delivery timeline: "ঢাকার ভিতরে ২-৩ দিন, বাইরে ৪-৫ দিন"

LEAD CAPTURE (natural, not robotic):
- Budget: "আপনার বাজেট কত?"
- Timeline: "কখন দরকার?"
- Phone: "ফোন নম্বর দিন কনফার্ম করতে"`

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${settings.system_prompt}\n\n${getChatGuardrailsPrompt()}\n\nLanguage: ${langInstruction}\n\nAuto-Reply Context:\n${autoReplyContext}${summaryBlock}\n\nউদাহরণ:\n${exampleBlock}${productContext}${personalityBlock}`,
    },
    ...fittedHistory.map(h => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: message },
  ];

  const replyStart = Date.now();
  const { logPerformanceMetric } = await import("./performance.functions");
  const replyResponse = await chatComplete(messages, settings.model, settings.lovable_api_key_override);
  let reply = typeof replyResponse === "string" ? replyResponse : "Streaming response initiated";

  // ── Chat guardrails check ───────────────────────────────────────────
  const guardrailResult = checkChatGuardrails(reply);
  if (!guardrailResult.passed) {
    console.warn(`[guardrails] Blocked reply: ${guardrailResult.reason}`);
    reply = getFallbackReply();
  } else if (guardrailResult.severity === "warning") {
    console.warn(`[guardrails] Warning: ${guardrailResult.reason}`);
  }

  await logPerformanceMetric("reply", Date.now() - replyStart, requestId);
  await logPerformanceMetric("overall", Date.now() - startTime, requestId);
  await logActionUsage({ data: { action: "ai_message", metadata: { model: settings.model, duration: Date.now() - startTime } } }).catch(console.error);

  return {
    reply,
    examples: examples.map(e => ({ question: e.question, answer: e.answer })),
    product_cards: product_cards && product_cards.length > 0 ? product_cards : undefined,
  };
}

// ─── logConversation ──────────────────────────────────────────────────────────

export async function logConversation(externalId: string | null, source: string, turns: HistoryTurn[], isDraft = false) {
  // NOTE: the pg-client shim resets the query mode when `.select()` is chained
  // after `.insert()` (turning the insert into a plain SELECT). Never chain
  // `.select()` after `.insert()` here — call `.single()` directly on the
  // insert (RETURNING *) instead.
  const { data: convRow, error: convErr } = await supabaseAdmin
    .from("conversations").insert({ external_id: externalId, source }).single() as any;
  if (convErr || !convRow?.id) {
    console.error("[logConversation] conversations insert failed:", convErr);
    return;
  }
  const conv = convRow as { id: string };

  const { error: msgErr } = await supabaseAdmin.from("messages").insert(
    turns.map((t, i) => ({ conversation_id: conv.id, role: t.role, content: t.content, seq: i }))
  );
  if (msgErr) console.error("[logConversation] messages insert failed:", msgErr);

  const lastUserMsg = turns.filter(t => t.role === "user").at(-1)?.content ?? "";
  const detectedLang = detectLanguage(lastUserMsg);
  let sessionId: string | null = null;

  if (externalId) {
    const { data: existing } = await supabaseAdmin
      .from("conversation_sessions").select("id").eq("external_id", externalId).eq("status", "active").maybeSingle();
    if (existing) {
      sessionId = existing.id;
      await supabaseAdmin.from("conversation_sessions")
        .update({ message_count: turns.length, last_message_at: new Date().toISOString(), customer_language: detectedLang })
        .eq("id", sessionId);
    } else {
      const { data: newSession, error: sessErr } = await supabaseAdmin
        .from("conversation_sessions")
        .insert({ external_id: externalId, channel: source, customer_language: detectedLang, message_count: turns.length })
        .single() as any;
      if (sessErr) console.error("[logConversation] session insert failed:", sessErr);
      sessionId = (newSession as any)?.id ?? null;
    }
  }

  if (sessionId) {
    await supabaseAdmin.from("session_messages").insert(
      turns.map(t => ({
        session_id: sessionId,
        role: t.role,
        content: t.content,
        channel: source,
        metadata: t.role === "assistant"
          ? { is_draft: isDraft, sent: !isDraft, ...(t.metadata ?? {}) }
          : { ...(t.metadata ?? {}) },
      }))
    );
  }

  try {
    await supabaseAdmin.from("analytics_events").insert({
      event_type: "conversation", channel: source,
      metadata: { language: detectedLang, message_count: turns.length, session_id: sessionId },
    });
  } catch {}

  const settings = await getSettings();
  const question = turns.filter(t => t.role === "user").at(-1)?.content;
  const answer = turns.filter(t => t.role === "assistant").at(-1)?.content;
  if (question && answer) {
    await supabaseAdmin.from("training_pairs").insert({
      question, answer, source, status: settings.auto_approve ? "approved" : "pending",
      conversation_id: conv.id, language: detectedLang,
    });
  }
}
