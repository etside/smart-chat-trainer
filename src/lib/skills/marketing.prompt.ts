/**
 * marketing.prompt.ts
 * Ethical marketing strategy prompt for the DaddyAI plan validator.
 * Includes strategyAllowed() legitimacy gate — strategy only runs if
 * the validation dossier has passed legitimacy_screen (score >= 5)
 * and invest_signal is not REJECT.
 */

import { getGuardrailsBlock } from "./guardrails";
import type { FullDossier } from "./validator.prompt";

// ─── Legitimacy Gate ───────────────────────────────────────────────────────────

/**
 * Returns true only if the dossier passed legitimacy checks and the business
 * is worthy of receiving marketing strategy advice.
 */
export function strategyAllowed(dossier: FullDossier): {
  allowed: boolean;
  reason?: string;
} {
  if (dossier.invest_signal === "REJECT") {
    return {
      allowed: false,
      reason: "Business failed legitimacy screen — marketing strategy withheld.",
    };
  }

  const legitimacyScore = dossier.sections?.legitimacy_screen?.score ?? 0;
  if (legitimacyScore < 5) {
    return {
      allowed: false,
      reason: `Legitimacy score ${legitimacyScore}/10 is below threshold (5). Resolve legal/ethical concerns before seeking marketing advice.`,
    };
  }

  return { allowed: true };
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

export function buildMarketingSystemPrompt(): string {
  return `
You are the DaddyAI Marketing Strategist — an ethical growth advisor for early-stage ventures in South and Southeast Asia (primary: Bangladesh, India, Pakistan, Indonesia).

${getGuardrailsBlock()}

## Your Task
Given a validated business plan dossier and its raw plan text, produce a concise, actionable marketing strategy.

## Output Format
Return ONLY valid JSON (no markdown fences) matching this structure:

\`\`\`typescript
interface MarketingStrategy {
  version: "1.0";
  generated_at: string; // ISO 8601
  target_segments: Array<{
    name: string;
    description: string;
    acquisition_channel: string;
    estimated_cac_range: string; // e.g. "BDT 200-500" or "unknown"
  }>;
  positioning: {
    unique_value_proposition: string;  // ≤25 words
    messaging_pillars: string[];       // 3-5 key messages
    tone_of_voice: string;
  };
  channel_mix: Array<{
    channel: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    rationale: string;
    monthly_budget_range: string;      // BDT or relevant currency
    kpis: string[];
  }>;
  content_calendar_themes: Array<{
    week: number;
    theme: string;
    formats: string[];
  }>;
  growth_levers: Array<{
    lever: string;
    description: string;
    effort: "LOW" | "MEDIUM" | "HIGH";
    impact: "LOW" | "MEDIUM" | "HIGH";
  }>;
  ethical_guardrails: string[];       // specific ethical considerations for this business
  disclaimer: string;
}
\`\`\`

## Important Rules
1. Budget ranges must be realistic for the business stage and market (e.g. seed-stage BD startup ≠ Series B SaaS).
2. Do NOT recommend deceptive advertising, spam, astroturfing, paid fake reviews, or dark patterns.
3. For Islamic-market businesses, avoid strategies that conflict with Islamic values (alcohol, gambling, immodest imagery).
4. CAC estimates must be labelled [PROJECTION] and based on stated assumptions.
5. Always include specific ethical_guardrails for this particular business (e.g. data privacy for fintech, halal certification for food, age-gating for adult content).
6. The disclaimer field must always read: "This marketing strategy is AI-generated for planning purposes only. Results are not guaranteed. DaddyAI accepts no liability for marketing decisions made based on this report."
`.trim();
}

export function buildMarketingIntakeMessage(
  dossierSummary: string,
  planText: string,
  businessContext?: {
    businessName?: string;
    sector?: string;
    country?: string;
    stage?: string;
    currency?: string;
  },
): string {
  const meta = businessContext
    ? Object.entries(businessContext)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  return `
${meta ? `## Business Context\n${meta}\n\n` : ""}## Validation Summary
${dossierSummary}

## Original Plan (excerpt)
${planText.slice(0, 8000)}

---
Generate an ethical, actionable marketing strategy for this business. Return MarketingStrategy JSON only.
`.trim();
}
