import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { DISCLAIMER } from "@/lib/validation-schema";
import type { FullDossier } from "@/lib/skills/validator.prompt";
import type { MarketingStrategy } from "@/lib/validation-schema";

export const Route = createFileRoute("/validate")({
  component: ValidatePage,
});

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SSEStatus { type: "status"; message: string }
interface SSEChunk { type: "chunk"; pass: 1 | 2; delta: string }
interface SSEPass1Done { type: "pass1_done"; dossier: FullDossier }
interface SSEPass2Done { type: "pass2_done"; strategy: MarketingStrategy }
interface SSEStrategySkipped { type: "strategy_skipped"; reason: string }
interface SSEError { type: "error"; message: string }
interface SSEDone { type: "done" }
type SSEEvent = SSEStatus | SSEChunk | SSEPass1Done | SSEPass2Done | SSEStrategySkipped | SSEError | SSEDone;

const INVEST_LABELS: Record<string, { label: string; color: string }> = {
  STRONG_YES:      { label: "Strong Yes",      color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  CONDITIONAL_YES: { label: "Conditional Yes", color: "text-blue-600 bg-blue-50 border-blue-200" },
  NEEDS_WORK:      { label: "Needs Work",       color: "text-amber-600 bg-amber-50 border-amber-200" },
  NOT_READY:       { label: "Not Ready",        color: "text-orange-600 bg-orange-50 border-orange-200" },
  REJECT:          { label: "Reject",           color: "text-red-600 bg-red-50 border-red-200" },
};

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-600",
  B: "text-blue-600",
  C: "text-amber-600",
  D: "text-orange-600",
  F: "text-red-600",
};

const SECTION_LABELS: Record<string, string> = {
  legitimacy_screen: "Legitimacy",
  executive_summary_quality: "Executive Summary",
  problem_solution_fit: "Problem / Solution Fit",
  market_analysis: "Market Analysis",
  business_model_clarity: "Business Model",
  competitive_landscape: "Competitive Landscape",
  go_to_market: "Go-to-Market",
  team_assessment: "Team",
  financial_projections: "Financials",
  funding_ask: "Funding Ask",
  risk_register: "Risk Register",
  traction_and_validation: "Traction & Validation",
  scalability_and_moat: "Scalability & Moat",
  esg_and_ethics: "ESG & Ethics",
  overall_verdict: "Overall Verdict",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const color =
    score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-200">
      <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const meta = INVEST_LABELS[signal] ?? { label: signal, color: "text-zinc-600 bg-zinc-100 border-zinc-200" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold", meta.color)}>
      {meta.label}
    </span>
  );
}

function SectionCard({ sectionKey, section }: { sectionKey: string; section: FullDossier["sections"][string] }) {
  const [open, setOpen] = useState(false);
  const label = SECTION_LABELS[sectionKey] ?? sectionKey;
  const grade = section?.grade ?? "F";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className={cn("text-lg font-bold", GRADE_COLOR[grade])}>{grade}</span>
            <span className="font-semibold text-zinc-800 truncate">{label}</span>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5 truncate">{section?.headline}</p>
          <ScoreBar score={section?.score ?? 0} />
        </div>
        <span className="ml-4 text-zinc-400 text-sm select-none">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4 space-y-4 text-sm">
          {(section?.findings?.length ?? 0) > 0 && (
            <div>
              <h4 className="font-semibold text-zinc-700 mb-1">Findings</h4>
              <ul className="space-y-1 text-zinc-600">
                {section.findings.map((f, i) => <li key={i} className="flex gap-2"><span className="mt-0.5 shrink-0 text-zinc-400">•</span>{f}</li>)}
              </ul>
            </div>
          )}
          {(section?.red_flags?.length ?? 0) > 0 && (
            <div>
              <h4 className="font-semibold text-red-600 mb-1">Red Flags</h4>
              <ul className="space-y-1 text-red-700">
                {section.red_flags.map((f, i) => <li key={i} className="flex gap-2"><span className="mt-0.5 shrink-0 text-red-500">•</span>{f}</li>)}
              </ul>
            </div>
          )}
          {(section?.recommendations?.length ?? 0) > 0 && (
            <div>
              <h4 className="font-semibold text-emerald-700 mb-1">Recommendations</h4>
              <ul className="space-y-1 text-emerald-800">
                {section.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span className="mt-0.5 shrink-0 text-emerald-400">→</span>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DossierTab({ dossier }: { dossier: FullDossier }) {
  const signal = INVEST_LABELS[dossier.invest_signal] ?? { label: dossier.invest_signal, color: "" };
  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="rounded-2xl bg-gradient-to-br from-card to-card/80 p-6 text-foreground">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-5xl font-black tracking-tight">
              <span className={GRADE_COLOR[dossier.overall_grade] ?? "text-foreground"}>{dossier.overall_grade}</span>
              <span className="ml-3 text-2xl text-zinc-400 font-semibold">{dossier.overall_score}/100</span>
            </div>
            <p className="mt-2 text-muted-foreground text-sm max-w-lg">{dossier.one_liner}</p>
          </div>
          <SignalBadge signal={dossier.invest_signal} />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {Object.entries(dossier.sections ?? {}).map(([key, section]) => (
          <SectionCard key={key} sectionKey={key} section={section as FullDossier["sections"][string]} />
        ))}
      </div>

      <p className="text-xs text-zinc-400 italic">{dossier.disclaimer ?? DISCLAIMER}</p>
    </div>
  );
}

function StrategyTab({ strategy }: { strategy: MarketingStrategy }) {
  return (
    <div className="space-y-6 text-sm">
      {/* Positioning */}
      {strategy.positioning?.unique_value_proposition && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="font-bold text-blue-800 mb-1">Unique Value Proposition</h3>
          <p className="text-blue-900 text-base font-medium">{strategy.positioning.unique_value_proposition}</p>
          {(strategy.positioning.messaging_pillars?.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 text-blue-700">
              {strategy.positioning.messaging_pillars.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Channel Mix */}
      {(strategy.channel_mix?.length ?? 0) > 0 && (
        <div>
          <h3 className="font-bold text-zinc-800 mb-3">Channel Mix</h3>
          <div className="space-y-3">
            {strategy.channel_mix.map((ch, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-zinc-800">{ch.channel}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold border",
                    ch.priority === "HIGH" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : ch.priority === "LOW" ? "bg-zinc-100 text-zinc-500 border-zinc-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>{ch.priority}</span>
                </div>
                <p className="text-zinc-600">{ch.rationale}</p>
                {ch.monthly_budget_range && <p className="mt-1 text-zinc-500">Budget: {ch.monthly_budget_range}/mo</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growth Levers */}
      {(strategy.growth_levers?.length ?? 0) > 0 && (
        <div>
          <h3 className="font-bold text-zinc-800 mb-3">Growth Levers</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {strategy.growth_levers.map((gl, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-800">{gl.lever}</span>
                  <span className="text-xs text-zinc-400 shrink-0">
                    Effort {gl.effort} · Impact {gl.impact}
                  </span>
                </div>
                <p className="mt-1 text-zinc-600">{gl.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ethical Guardrails */}
      {(strategy.ethical_guardrails?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-800 mb-2">Ethical Guardrails</h3>
          <ul className="space-y-1 text-amber-700">
            {strategy.ethical_guardrails.map((g, i) => <li key={i}>• {g}</li>)}
          </ul>
        </div>
      )}

      <p className="text-xs text-zinc-400 italic">{strategy.disclaimer}</p>
    </div>
  );
}

function RawJsonTab({ data }: { data: unknown }) {
  return (
    <pre className="overflow-auto rounded-xl bg-muted p-5 text-xs text-foreground max-h-[60vh]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Console ───────────────────────────────────────────────────────────────────

function SwarmConsole({ lines }: { lines: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="rounded-xl bg-muted border border-border p-4 h-52 overflow-y-auto font-mono text-xs text-emerald-500 space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className="leading-5 whitespace-pre-wrap break-all opacity-90">{l}</div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function ValidatePage() {
  // Form state
  const [planText, setPlanText] = useState("");
  const [founderName, setFounderName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [askAmount, setAskAmount] = useState("");
  const [additionalCtx, setAdditionalCtx] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  // Stream state
  const [running, setRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [dossier, setDossier] = useState<FullDossier | null>(null);
  const [strategy, setStrategy] = useState<MarketingStrategy | null>(null);
  const [strategySkipped, setStrategySkipped] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dossier" | "strategy" | "json">("dossier");
  const abortRef = useRef<AbortController | null>(null);

  const log = useCallback((msg: string) => {
    setConsoleLines((prev) => [...prev.slice(-200), msg]);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;

    setRunning(true);
    setConsoleLines([]);
    setDossier(null);
    setStrategy(null);
    setStrategySkipped(null);
    setError(null);
    setActiveTab("dossier");

    abortRef.current = new AbortController();

    try {
      let body: BodyInit;
      let headers: Record<string, string> = {};

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("founderName", founderName);
        fd.append("businessName", businessName);
        fd.append("sector", sector);
        fd.append("stage", stage);
        fd.append("country", country);
        fd.append("askAmount", askAmount);
        fd.append("additionalContext", additionalCtx);
        body = fd;
      } else {
        body = JSON.stringify({
          planText: url ? undefined : planText,
          url: url || undefined,
          founderName, businessName, sector, stage, country, askAmount,
          additionalContext: additionalCtx,
        });
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch("/api/public/validate-stream", {
        method: "POST",
        headers,
        body,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Server error ${res.status}: ${msg}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let evt: SSEEvent;
          try { evt = JSON.parse(raw) as SSEEvent; } catch { continue; }

          switch (evt.type) {
            case "status":
              log(`> ${evt.message}`);
              break;
            case "chunk":
              log(evt.pass === 1 ? `[V] ${evt.delta}` : `[M] ${evt.delta}`);
              break;
            case "pass1_done":
              setDossier(evt.dossier);
              log(`[OK] Validation complete — score ${evt.dossier.overall_score}/100 (${evt.dossier.overall_grade})`);
              break;
            case "pass2_done":
              setStrategy(evt.strategy);
              setActiveTab("strategy");
              log(`[OK] Marketing strategy ready`);
              break;
            case "strategy_skipped":
              setStrategySkipped(evt.reason);
              log(`[!] Strategy skipped: ${evt.reason}`);
              break;
            case "error":
              setError(evt.message);
              log(`[ERR] Error: ${evt.message}`);
              break;
            case "done":
              log("— Done —");
              break;
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        const msg = (err as Error)?.message ?? String(err);
        setError(msg);
        log(`[ERR] ${msg}`);
      }
    } finally {
      setRunning(false);
    }
  }, [running, file, planText, url, founderName, businessName, sector, stage, country, askAmount, additionalCtx, log]);

  const handleStop = () => {
    abortRef.current?.abort();
    setRunning(false);
    log("— Stopped —");
  };

  const exportJson = () => {
    if (!dossier) return;
    const data = JSON.stringify({ dossier, strategy }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${businessName || "plan"}-dossier.json`;
    a.click();
  };

  const exportMarkdown = () => {
    if (!dossier) return;
    const lines: string[] = [
      `# Business Plan Validation Dossier`,
      `**Business:** ${businessName || "—"}  `,
      `**Score:** ${dossier.overall_score}/100 (${dossier.overall_grade})  `,
      `**Signal:** ${dossier.invest_signal}  `,
      `**Verdict:** ${dossier.one_liner}`,
      "",
      "---",
      "",
    ];
    for (const [key, sec] of Object.entries(dossier.sections ?? {})) {
      const s = sec as FullDossier["sections"][string];
      lines.push(`## ${SECTION_LABELS[key] ?? key} — ${s?.grade} (${s?.score}/10)`);
      lines.push(s?.headline ?? "");
      if (s?.findings?.length) {
        lines.push("", "**Findings**");
        s.findings.forEach((f) => lines.push(`- ${f}`));
      }
      if (s?.red_flags?.length) {
        lines.push("", "**Red Flags**");
        s.red_flags.forEach((f) => lines.push(`- ${f}`));
      }
      if (s?.recommendations?.length) {
        lines.push("", "**Recommendations**");
        s.recommendations.forEach((r) => lines.push(`- ${r}`));
      }
      lines.push("");
    }
    lines.push("---", "", `*${dossier.disclaimer ?? DISCLAIMER}*`);
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${businessName || "plan"}-dossier.md`;
    a.click();
  };

  const showResults = dossier || error || running;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Plan Validator</h1>
            <p className="text-xs text-zinc-500">15-section AI dossier + ethical marketing strategy</p>
          </div>
          {dossier && (
            <div className="flex gap-2">
              <button onClick={exportMarkdown} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">↓ Markdown</button>
              <button onClick={exportJson} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">↓ JSON</button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Intake Panel */}
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-6 space-y-5">
          <h2 className="text-lg font-bold text-zinc-800">Submit Your Plan</h2>

          {/* Plan input */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Plan Text</label>
              <textarea
                className="w-full min-h-40 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 resize-y placeholder:text-zinc-400"
                placeholder="Paste your executive summary, pitch deck content, or full business plan here…"
                value={planText}
                onChange={(e) => setPlanText(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Or Upload File (PDF/DOCX/TXT/MD/JSON)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.json"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                />
                {file && <p className="mt-1 text-xs text-zinc-500">Selected: {file.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Or URL</label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 placeholder:text-zinc-400"
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Business Name", value: businessName, set: setBusinessName, placeholder: "Acme Corp" },
              { label: "Founder / Submitter", value: founderName, set: setFounderName, placeholder: "Jane Doe" },
              { label: "Sector", value: sector, set: setSector, placeholder: "e-commerce, fintech…" },
              { label: "Stage", value: stage, set: setStage, placeholder: "Idea, MVP, Seed…" },
              { label: "Target Country", value: country, set: setCountry, placeholder: "Bangladesh" },
              { label: "Funding Ask", value: askAmount, set: setAskAmount, placeholder: "BDT 50,00,000" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-zinc-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 placeholder:text-zinc-400"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Additional Context (optional)</label>
            <textarea
              className="w-full h-20 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 resize-none placeholder:text-zinc-400"
              placeholder="Any extra context for the validator…"
              value={additionalCtx}
              onChange={(e) => setAdditionalCtx(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={running || (!planText.trim() && !file && !url.trim())}
              className={cn(
                "rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all",
                running
                  ? "bg-zinc-400 cursor-not-allowed"
                  : "bg-zinc-900 hover:bg-zinc-700 active:scale-95"
              )}
            >
              {running ? "Validating…" : "Validate Plan"}
            </button>
            {running && (
              <button
                type="button"
                onClick={handleStop}
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Stop
              </button>
            )}
          </div>
        </form>

        {/* Screen-status banner */}
        {error && !running && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}
        {strategySkipped && dossier && !running && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-700">
            <strong>Strategy skipped:</strong> {strategySkipped}
          </div>
        )}

        {/* Live console */}
        {(running || consoleLines.length > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              {running && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
              <span className="text-xs font-mono text-zinc-500">
                {running ? "Processing…" : "Complete"}
              </span>
            </div>
            <SwarmConsole lines={consoleLines} />
          </div>
        )}

        {/* Results */}
        {showResults && dossier && (
          <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-zinc-200">
              {(["dossier", "strategy", "json"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-5 py-3 text-sm font-semibold transition-colors capitalize",
                    activeTab === tab
                      ? "border-b-2 border-foreground text-foreground"
                      : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  {tab === "dossier" ? "Validation Dossier" : tab === "strategy" ? "Marketing Strategy" : "Raw JSON"}
                  {tab === "strategy" && strategy && (
                    <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">new</span>
                  )}
                </button>
              ))}
            </div>
            <div className="p-6">
              {activeTab === "dossier" && <DossierTab dossier={dossier} />}
              {activeTab === "strategy" && strategy && <StrategyTab strategy={strategy} />}
              {activeTab === "strategy" && !strategy && (
                <p className="text-sm text-zinc-500 text-center py-8">
                  {strategySkipped ?? (running ? "Generating strategy…" : "No strategy available.")}
                </p>
              )}
              {activeTab === "json" && <RawJsonTab data={{ dossier, strategy }} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
