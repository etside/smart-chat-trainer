import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2, Rocket } from "lucide-react";

export const Route = createFileRoute("/admin/readiness")({
  component: ReadinessPage,
});

// ── Server function ──────────────────────────────────────────────────────────

const runReadinessCheck = createServerFn({ method: "GET" }).handler(async () => {
  const checks: { id: string; name: string; status: "pass" | "fail" | "warn"; detail: string }[] = [];

  // 1. Webhook — check recent webhook_logs
  const { data: wh } = await supabaseAdmin
    .from("webhook_logs")
    .select("id")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);
  checks.push({
    id: "webhook",
    name: "Webhook receiving messages",
    status: wh && wh.length > 0 ? "pass" : "warn",
    detail: wh && wh.length > 0 ? "Recent webhook events found" : "No webhook events in last 24h",
  });

  // 2. AI drafts generating
  const { data: drafts } = await supabaseAdmin
    .from("session_messages")
    .select("id")
    .eq("role", "assistant")
    .contains("metadata", { is_draft: true })
    .limit(1);
  checks.push({
    id: "drafts",
    name: "AI drafts generating",
    status: drafts && drafts.length > 0 ? "pass" : "warn",
    detail: drafts && drafts.length > 0 ? "Draft messages found" : "No draft messages found",
  });

  // 3. Meta access token configured
  const { data: settings } = await supabaseAdmin
    .from("agent_settings")
    .select("meta_access_token, meta_page_id, meta_app_secret, auto_reply_mode, ai_api_key, fish_audio_api_key")
    .eq("id", 1)
    .maybeSingle();

  const hasToken = !!(settings as any)?.meta_access_token;
  checks.push({
    id: "meta_token",
    name: "Page Access Token configured",
    status: hasToken ? "pass" : "fail",
    detail: hasToken ? "Token is set" : "meta_access_token not set in agent_settings",
  });

  // 4. AI key configured
  const hasAiKey = !!(settings as any)?.ai_api_key;
  checks.push({
    id: "ai_key",
    name: "AI API key configured",
    status: hasAiKey ? "pass" : "fail",
    detail: hasAiKey ? "AI key set" : "ai_api_key not set",
  });

  // 5. Auto-reply mode
  const autoMode = (settings as any)?.auto_reply_mode ?? "off";
  checks.push({
    id: "auto_reply",
    name: "Auto-reply mode",
    status: autoMode === "on" ? "pass" : "warn",
    detail: `Mode is '${autoMode}' — set to 'on' to enable automatic replies`,
  });

  // 6. Training pairs count
  const { count: pairCount } = await supabaseAdmin
    .from("training_pairs")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");
  checks.push({
    id: "training",
    name: "Training data",
    status: (pairCount ?? 0) > 100 ? "pass" : (pairCount ?? 0) > 0 ? "warn" : "fail",
    detail: `${(pairCount ?? 0).toLocaleString()} approved training pairs`,
  });

  // 7. Products synced
  const { count: productCount } = await supabaseAdmin
    .from("product_catalogue")
    .select("*", { count: "exact", head: true });
  checks.push({
    id: "products",
    name: "Product catalogue",
    status: (productCount ?? 0) > 0 ? "pass" : "warn",
    detail: `${productCount ?? 0} products in catalogue`,
  });

  // 8. Auto-reply rules
  const { count: rulesCount } = await supabaseAdmin
    .from("auto_reply_rules")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  checks.push({
    id: "rules",
    name: "Auto-reply rules",
    status: (rulesCount ?? 0) > 0 ? "pass" : "warn",
    detail: `${rulesCount ?? 0} active rules configured`,
  });

  // 9. Canned responses
  const { count: cannedCount } = await supabaseAdmin
    .from("auto_reply_templates")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");
  checks.push({
    id: "canned",
    name: "Canned responses",
    status: (cannedCount ?? 0) > 0 ? "pass" : "warn",
    detail: `${cannedCount ?? 0} published templates`,
  });

  // 10. Voice / Fish Audio
  const hasFishKey = !!(settings as any)?.fish_audio_api_key;
  checks.push({
    id: "voice",
    name: "Voice cloning (Fish Audio)",
    status: hasFishKey ? "pass" : "warn",
    detail: hasFishKey ? "Fish Audio key configured" : "fish_audio_api_key not set — voice replies disabled",
  });

  // Cost estimate (based on session_messages count)
  const { count: msgCount } = await supabaseAdmin
    .from("session_messages")
    .select("*", { count: "exact", head: true });
  const dailyMsgs = Math.round((msgCount ?? 0) / 30); // rough estimate
  const monthlyAiCost = (dailyMsgs * 30 * 0.0002).toFixed(2); // ~$0.0002/msg

  const score = checks.filter(c => c.status === "pass").length;

  return {
    checks,
    score,
    total: checks.length,
    stats: {
      totalMessages: msgCount ?? 0,
      estimatedDailyMessages: dailyMsgs,
      estimatedMonthlyCost: monthlyAiCost,
      trainingPairs: pairCount ?? 0,
      products: productCount ?? 0,
    },
  };
});

// ── Component ────────────────────────────────────────────────────────────────

function ReadinessPage() {
  const fn = useServerFn(runReadinessCheck);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["readiness"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const score = data?.score ?? 0;
  const total = data?.total ?? 10;
  const pct = Math.round((score / total) * 100);

  const scoreColor =
    pct >= 80 ? "text-green-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  const scoreBg =
    pct >= 80 ? "bg-green-500/20 border-green-500/20" : pct >= 50 ? "bg-amber-500/20 border-amber-500/20" : "bg-red-500/20 border-red-500/20";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Rocket className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Launch Readiness</h1>
            <p className="text-sm text-muted-foreground">Full system audit before going live</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading} className="gap-1.5">
          {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Score card */}
      <div className={cn("rounded-2xl border p-6 text-center", scoreBg)}>
        {isLoading ? (
          <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
        ) : (
          <>
            <p className={cn("text-6xl font-black", scoreColor)}>{pct}%</p>
            <p className="mt-1 text-sm text-muted-foreground font-semibold">
              {score}/{total} checks passing
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {pct >= 80 ? "Ready to launch!" : pct >= 50 ? "Almost there — fix warnings first" : "Not ready — critical failures"}
            </p>
          </>
        )}
      </div>

      {/* Checks list */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="panel p-4 h-14 animate-pulse bg-muted/30" />
            ))
          : data?.checks.map((check) => (
              <div key={check.id} className="panel p-4 flex items-center gap-3">
                {check.status === "pass" && <CheckCircle2 className="size-5 text-green-400 shrink-0" />}
                {check.status === "fail" && <XCircle className="size-5 text-red-400 shrink-0" />}
                {check.status === "warn" && <AlertTriangle className="size-5 text-amber-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{check.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{check.detail}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                  check.status === "pass" ? "bg-green-500/20 text-green-400" :
                  check.status === "fail" ? "bg-red-500/20 text-red-400" :
                  "bg-amber-500/20 text-amber-400"
                )}>
                  {check.status}
                </span>
              </div>
            ))}
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="panel p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cost Estimate</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Messages", value: data.stats.totalMessages.toLocaleString() },
              { label: "Daily Avg", value: data.stats.estimatedDailyMessages.toLocaleString() },
              { label: "Est. Monthly AI Cost", value: `$${data.stats.estimatedMonthlyCost}` },
              { label: "Training Pairs", value: data.stats.trainingPairs.toLocaleString() },
            ].map((s) => (
              <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-lg font-black">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
