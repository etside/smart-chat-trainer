/**
 * validator.prompt.ts
 * Full system prompt for the 15-section business plan validator, plus
 * helpers for building intake messages and parsing dossier JSON.
 */

import { getGuardrailsBlock } from "./guardrails";

// ─── 15-Section Dossier Schema ──────────────────────────────────────────────────

export const DOSSIER_SECTIONS = [
  "legitimacy_screen",
  "executive_summary_quality",
  "problem_solution_fit",
  "market_analysis",
  "business_model_clarity",
  "competitive_landscape",
  "go_to_market",
  "team_assessment",
  "financial_projections",
  "funding_ask",
  "risk_register",
  "traction_and_validation",
  "scalability_and_moat",
  "esg_and_ethics",
  "overall_verdict",
] as const;

export type DossierSectionKey = (typeof DOSSIER_SECTIONS)[number];

export interface DossierSection {
  score: number; // 0-10
  grade: "A" | "B" | "C" | "D" | "F";
  headline: string; // one-line summary
  findings: string[]; // 2-5 bullet points
  red_flags: string[]; // critical issues, can be empty
  recommendations: string[]; // actionable suggestions
}

export interface FullDossier {
  version: string;
  generated_at: string;
  overall_score: number; // 0-100, weighted average
  overall_grade: "A" | "B" | "C" | "D" | "F";
  invest_signal: "STRONG_YES" | "CONDITIONAL_YES" | "NEEDS_WORK" | "NOT_READY" | "REJECT";
  one_liner: string; // 15-word verdict
  sections: Record<DossierSectionKey, DossierSection>;
  disclaimer: string;
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

export function buildValidatorSystemPrompt(): string {
  return `
You are the DaddyAI Business Plan Validator — an expert AI analyst for early-stage and growth-stage ventures in South and Southeast Asia.
Your job: analyse a business plan and return a structured 15-section dossier as JSON.

${getGuardrailsBlock()}

## Output Format
Return ONLY valid JSON (no markdown code fences, no preamble) matching this TypeScript type:

\`\`\`typescript
interface FullDossier {
  version: "1.0";
  generated_at: string; // ISO 8601
  overall_score: number; // 0-100 weighted
  overall_grade: "A" | "B" | "C" | "D" | "F";
  invest_signal: "STRONG_YES" | "CONDITIONAL_YES" | "NEEDS_WORK" | "NOT_READY" | "REJECT";
  one_liner: string; // ≤15 words summarising the verdict
  sections: {
    [key in
      "legitimacy_screen" |
      "executive_summary_quality" |
      "problem_solution_fit" |
      "market_analysis" |
      "business_model_clarity" |
      "competitive_landscape" |
      "go_to_market" |
      "team_assessment" |
      "financial_projections" |
      "funding_ask" |
      "risk_register" |
      "traction_and_validation" |
      "scalability_and_moat" |
      "esg_and_ethics" |
      "overall_verdict"
    ]: {
      score: number;        // 0-10
      grade: "A"|"B"|"C"|"D"|"F";
      headline: string;     // one-line summary ≤80 chars
      findings: string[];   // 2-5 specific findings
      red_flags: string[];  // critical risks (empty array if none)
      recommendations: string[]; // 2-4 actionable next steps
    };
  };
  disclaimer: string; // include standard disclaimer
}
\`\`\`

## Scoring Weights
legitimacy_screen: 15%
problem_solution_fit: 10%
market_analysis: 10%
business_model_clarity: 10%
financial_projections: 10%
team_assessment: 10%
go_to_market: 8%
competitive_landscape: 7%
traction_and_validation: 7%
scalability_and_moat: 5%
risk_register: 3%
funding_ask: 3%
esg_and_ethics: 2%

## Section Instructions
- legitimacy_screen: Is this business legal and ethical in its target market? Check for regulatory red flags, pyramid/MLM structures, usury (riba), unlicensed fintech, or other legal issues. Score 10 = fully legitimate; 0 = clearly illegal or unethical.
- executive_summary_quality: Is the plan clear, concise, compelling? Does it answer who, what, why, how much?
- problem_solution_fit: Is the problem real and significant? Does the solution directly address it?
- market_analysis: Is the TAM/SAM/SOM realistic? Are customer segments clearly defined?
- business_model_clarity: Is the revenue model clear and sustainable? Unit economics?
- competitive_landscape: Are competitors identified? Is the positioning differentiated?
- go_to_market: Is there a credible customer acquisition strategy with channels and CAC estimates?
- team_assessment: Does the team have relevant experience and domain expertise?
- financial_projections: Are projections realistic, well-reasoned, and clearly labelled [PROJECTION]?
- funding_ask: Is the ask amount justified? Is use-of-funds specific?
- risk_register: Are key risks identified with mitigations?
- traction_and_validation: Is there evidence of customer interest, pilots, revenue, or partnerships?
- scalability_and_moat: Can this scale? Is there a defensible advantage (IP, network effects, switching costs)?
- esg_and_ethics: Environmental, social, and governance considerations.
- overall_verdict: Synthesise everything. Should an investor look closer?

## Important
- If the legitimacy_screen score is below 5, set invest_signal to "REJECT" regardless of other scores.
- Be specific. Vague praise or generic criticism is not useful.
- Use [FACT], [ASSUMPTION], [PROJECTION] labels in findings.
- The disclaimer field must always read: "${getStandardDisclaimer()}"
`.trim();
}

// ─── Intake Builder ─────────────────────────────────────────────────────────────

export interface PlanIntake {
  planText: string;
  founderName?: string;
  businessName?: string;
  sector?: string;
  stage?: string;
  country?: string;
  askAmount?: string;
  currency?: string;
  additionalContext?: string;
}

export function buildIntakeMessage(intake: PlanIntake): string {
  const meta = [
    intake.businessName && `Business: ${intake.businessName}`,
    intake.founderName && `Founder/Submitter: ${intake.founderName}`,
    intake.sector && `Sector: ${intake.sector}`,
    intake.stage && `Stage: ${intake.stage}`,
    intake.country && `Target Market: ${intake.country}`,
    intake.askAmount && `Funding Ask: ${intake.currency ?? "BDT"} ${intake.askAmount}`,
    intake.additionalContext && `Additional Context: ${intake.additionalContext}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `
${meta ? `## Plan Metadata\n${meta}\n\n` : ""}## Business Plan Content

${intake.planText}

---
Analyse this plan and return the full FullDossier JSON. Remember: no fabricated figures, legitimacy first.
`.trim();
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

export function getStandardDisclaimer(): string {
  return (
    "This report is generated by an AI system for informational purposes only. " +
    "It does not constitute investment advice, legal advice, or Shariah-compliance certification. " +
    "Consult qualified legal, financial, and Shariah advisers before making investment decisions. " +
    "DaddyAI and its affiliates accept no liability for decisions made based on this report."
  );
}

export function gradeFromScore(score: number): FullDossier["overall_grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function parseDossierJson(raw: string): FullDossier | null {
  try {
    // Strip possible markdown fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as FullDossier;
    // Basic validation
    if (!parsed.sections || !parsed.overall_score) return null;
    // Ensure disclaimer
    if (!parsed.disclaimer) {
      parsed.disclaimer = getStandardDisclaimer();
    }
    return parsed;
  } catch {
    return null;
  }
}
