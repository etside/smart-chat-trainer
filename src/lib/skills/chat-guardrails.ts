/**
 * chat-guardrails.ts
 * Content safety & quality filters for outgoing AI chat messages.
 *
 * Prevents the agent from sending:
 *  - Offensive, disturbing, or inappropriate content
 *  - Random off-topic replies
 *  - Overly aggressive or manipulative sales language
 *  - Personal data leaks
 *  - Replies that are too short (gibberish) or too long (spam)
 *
 * Runs AFTER the AI generates a reply but BEFORE it is sent to the user.
 */

export const CHAT_GUARDRAILS_VERSION = "1.0.0";

// ─── Blocked content patterns ────────────────────────────────────────────────

/** Profanity & slurs (Bengali + English + Banglish romanised) */
const PROFANITY_PATTERNS = [
  // English
  /\b(fuck|shit|damn|bitch|asshole|bastard|crap|dick|piss|slut|whore)\b/gi,
  // Bengali script (common slurs)
  /[\u0980-\u09FF]*(মাগী|বেশ্যা|শুয়োর|কুত্তা|হারামি|বদমাশ|পাজি)[\u0980-\u09FF]*/g,
  // Banglish romanised
  /\b(magi|bessha|shuor|kutta|harami|badmash|paji|chudirbhai)\b/gi,
];

/** Disturbing / threatening language */
const THREAT_PATTERNS = [
  /\b(kill|murder|die|death|threat|hurt|harm|attack|bomb|weapon|gun|knife)\b/gi,
  /[\u0980-\u09FF]*(মারা|হত্যা|ধমকি|আক্রমণ|বোমা|অস্ত্র)[\u0980-\u09FF]*/g,
];

/** Personal data leak patterns */
const PII_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // credit card patterns
  /\b\d{10,17}\b/g, // NID / passport numbers (10-17 digits)
];

/** Manipulative sales pressure patterns */
const PRESSURE_PATTERNS = [
  /(এখনই কিনুন|শেষ সুযোগ|মাত্র \d+টি বাকি|অফার শেষ|আজকেই অর্ডার করুন নাহলে)/gi,
  /\b(buy now|last chance|only \d+ left|offer expires|order now or miss out)\b/gi,
  /(পারবেন না|পারবো না|অসম্ভব|ভুল করেছেন|আপনি ভুল)/gi, // discouraging language
];

// ─── Quality thresholds ──────────────────────────────────────────────────────

const MIN_REPLY_LENGTH = 5;       // chars — shorter is likely gibberish
const MAX_REPLY_LENGTH = 4000;    // chars — longer is likely spam or runaway
const MAX_EMOJI_RATIO = 0.3;      // >30% emojis = low quality
const MAX_REPEAT_RATIO = 0.5;     // >50% repeated chars = low quality

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuardrailResult {
  passed: boolean;
  reason?: string;
  sanitized?: string;  // cleaned version if minor issues found
  severity: "ok" | "warning" | "blocked";
}

// ─── Core filter functions ───────────────────────────────────────────────────

function containsProfanity(text: string): boolean {
  return PROFANITY_PATTERNS.some(p => p.test(text));
}

function containsThreats(text: string): boolean {
  return THREAT_PATTERNS.some(p => p.test(text));
}

function containsPII(text: string): boolean {
  // Allow if it looks like product info (prices, product codes)
  const lines = text.split("\n");
  const suspiciousLines = lines.filter(l => {
    const trimmed = l.trim();
    // Skip lines that look like product/price info
    if (/^(৳|₹|\$|price|দাম|মূল্য|টাকা)/i.test(trimmed)) return false;
    if (/product|পণ্য|স্টক|stock/i.test(trimmed)) return false;
    return PII_PATTERNS.some(p => {
      p.lastIndex = 0;
      return p.test(trimmed);
    });
  });
  return suspiciousLines.length > 2; // flag only if multiple PII hits
}

function containsPressureLanguage(text: string): boolean {
  return PRESSURE_PATTERNS.some(p => {
    p.lastIndex = 0;
    return p.test(text);
  });
}

function isLowQuality(text: string): { low: boolean; reason?: string } {
  const trimmed = text.trim();

  // Too short
  if (trimmed.length < MIN_REPLY_LENGTH) {
    return { low: true, reason: "Reply too short — likely gibberish" };
  }

  // Too long
  if (trimmed.length > MAX_REPLY_LENGTH) {
    return { low: true, reason: "Reply too long — possible spam or runaway generation" };
  }

  // Emoji spam
  const emojiCount = (trimmed.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 0 && emojiCount / trimmed.length > MAX_EMOJI_RATIO) {
    return { low: true, reason: "Too many emojis — low quality reply" };
  }

  // Repeated characters (e.g., "aaaaaaa" or "!!!!!!")
  const chars = trimmed.split("");
  const repeatCount = chars.filter((c, i) => i > 0 && c === chars[i - 1]).length;
  if (repeatCount / chars.length > MAX_REPEAT_RATIO) {
    return { low: true, reason: "Too many repeated characters — low quality" };
  }

  return { low: false };
}

// ─── Main guardrail check ────────────────────────────────────────────────────

/**
 * Check an AI-generated reply against all guardrails.
 * Returns a result indicating whether the reply should be sent.
 */
export function checkChatGuardrails(reply: string): GuardrailResult {
  if (!reply || typeof reply !== "string") {
    return { passed: false, reason: "Empty or invalid reply", severity: "blocked" };
  }

  // 1. Profanity — hard block
  if (containsProfanity(reply)) {
    return {
      passed: false,
      reason: "Reply contains profanity or offensive language",
      severity: "blocked",
    };
  }

  // 2. Threats — hard block
  if (containsThreats(reply)) {
    return {
      passed: false,
      reason: "Reply contains threatening or violent language",
      severity: "blocked",
    };
  }

  // 3. PII leak — hard block
  if (containsPII(reply)) {
    return {
      passed: false,
      reason: "Reply may contain personal data (phone, email, ID numbers)",
      severity: "blocked",
    };
  }

  // 4. Pressure language — warning (allow but flag)
  if (containsPressureLanguage(reply)) {
    return {
      passed: true,
      reason: "Reply contains aggressive sales pressure — consider softening",
      severity: "warning",
    };
  }

  // 5. Quality check — hard block for gibberish/spam
  const quality = isLowQuality(reply);
  if (quality.low) {
    return {
      passed: false,
      reason: quality.reason,
      severity: "blocked",
    };
  }

  return { passed: true, severity: "ok" };
}

/**
 * Returns the chat guardrails block for inclusion in system prompts.
 */
export function getChatGuardrailsPrompt(): string {
  return `
## Chat Guardrails (v${CHAT_GUARDRAILS_VERSION})

You are a professional, respectful sales assistant. Follow these rules strictly:

### Tone & Language
- Be warm, helpful, and respectful at all times
- Never use profanity, slurs, or offensive language
- Never threaten, pressure, or manipulate the customer
- Use gentle persuasion, not aggressive sales tactics

### Content Safety
- Never share personal data (phone numbers, emails, IDs) of anyone
- Never generate content that could be disturbing or distressing
- If a customer is upset, acknowledge their feelings and offer to help

### Response Quality
- Keep replies focused on the customer's question
- Don't send random or off-topic messages
- If you don't know the answer, say so honestly
- Don't repeat the same message multiple times

### Sales Ethics
- Don't create false urgency ("only 1 left!", "offer expires now!")
- Don't make claims you can't verify
- Be honest about product availability and pricing
- If a product is out of stock, suggest alternatives politely
`.trim();
}

/**
 * Fallback reply when guardrails block a generated response.
 */
export function getFallbackReply(): string {
  return "দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন অথবা আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।";
}
