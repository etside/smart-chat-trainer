import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExtraSettingsAdmin, updateExtraSettings } from "@/lib/extra-settings.functions";
import { getAgentSettings, saveAgentSettings, testAiConnection } from "@/lib/console.functions";
import { getMetaCredentials, updateMetaCredentials } from "@/lib/settings.functions";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight,
  Code2, Copy, Database, ExternalLink, Eye, EyeOff, Globe, Key,
  Loader2, MessageSquare, RefreshCw, Save, Server, Settings,
  ShieldCheck, Sparkles, Terminal, Webhook, X, Zap, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/api-hub")({ component: ApiHubPage });

// ── Types ────────────────────────────────────────────────────────────────────

type ApiCategory = {
  id: string;
  label: string;
  icon: typeof Bot;
  color: string;
  description: string;
  apis: ApiEntry[];
};

type ApiEntry = {
  id: string;
  name: string;
  endpoint?: string;
  description: string;
  authType: "api_key" | "oauth" | "jwt" | "none" | "env";
  status: "configured" | "unconfigured" | "built_in";
  routing?: "auto" | "manual" | "fallback";
  docs?: string;
  cost?: "free" | "paid" | "free_tier";
};

// ── Static API registry ───────────────────────────────────────────────────────

const INTERNAL_ROUTES: ApiEntry[] = [
  { id: "mcp",             name: "MCP (Model Context Protocol)", endpoint: "/mcp",                         description: "DaddyAI MCP server — 7 tools for product search, training, sync, backup",    authType: "api_key", status: "built_in", routing: "auto",   docs: "https://daddyai.online/mcp" },
  { id: "webhook_meta",    name: "Meta Webhook (FB/IG/WA)",      endpoint: "/api/public/webhooks/meta",     description: "Receives Messenger, Instagram, WhatsApp messages from Meta",                  authType: "none",    status: "built_in", routing: "auto" },
  { id: "webhook_stock",   name: "Stock Change Webhook",          endpoint: "/api/public/webhook/stock-change", description: "Receives inventory updates from Wear Impressive ERP",                   authType: "env",     status: "built_in", routing: "auto" },
  { id: "webhook_generic", name: "Generic Webhook",               endpoint: "/api/public/webhook",           description: "General webhook receiver",                                                   authType: "env",     status: "built_in", routing: "auto" },
  { id: "cron_learn",      name: "Cron: Auto-Learn",              endpoint: "/api/cron/learn",               description: "Scheduled auto-training and cleanup cron",                                   authType: "env",     status: "built_in", routing: "auto" },
  { id: "cron_train",      name: "Cron: Training Pipeline",       endpoint: "/api/cron/training-pipeline",   description: "Bulk training pair generation pipeline",                                     authType: "env",     status: "built_in", routing: "auto" },
  { id: "cron_sync",       name: "Cron: Catalog Sync",            endpoint: "/api/public/cron/sync",         description: "Product catalog sync from WearImpressive",                                   authType: "env",     status: "built_in", routing: "auto" },
  { id: "cron_autotrain",  name: "Cron: Auto-Train",              endpoint: "/api/public/cron/auto-train",   description: "Lightweight auto-training trigger",                                          authType: "env",     status: "built_in", routing: "auto" },
  { id: "meta_callback",   name: "Meta OAuth Callback",           endpoint: "/api/meta/callback",            description: "Facebook OAuth redirect handler",                                             authType: "oauth",   status: "built_in", routing: "auto" },
  { id: "meta_pages",      name: "Meta Pages API",                endpoint: "/api/meta/pages",               description: "List connected Facebook pages",                                              authType: "oauth",   status: "built_in", routing: "auto" },
  { id: "facebook_mcp",    name: "Facebook MCP",                  endpoint: "/api/public/facebook-mcp",      description: "Facebook-specific MCP endpoint",                                             authType: "api_key", status: "built_in", routing: "auto" },
  { id: "meta_mcp",        name: "Meta MCP",                      endpoint: "/api/public/meta-mcp",          description: "Meta platform MCP endpoint",                                                 authType: "api_key", status: "built_in", routing: "auto" },
  { id: "saas_tenant",     name: "SaaS: Create Tenant",           endpoint: "/api/saas/create-tenant",       description: "Provision new multi-tenant accounts",                                        authType: "jwt",     status: "built_in", routing: "manual" },
  { id: "chat_public",     name: "Public Chat API",               endpoint: "/api/public/chat",              description: "Widget and external chat completion endpoint",                               authType: "api_key", status: "built_in", routing: "auto" },
  { id: "validate_stream", name: "Validate Stream",               endpoint: "/api/public/validate-stream",   description: "Real-time streaming validation endpoint",                                    authType: "api_key", status: "built_in", routing: "auto" },
  { id: "pin_check",       name: "Admin PIN Check",               endpoint: "/api/admin/pin-check",          description: "Verify admin PIN for PinGuard",                                              authType: "jwt",     status: "built_in", routing: "auto" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function MaskedInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  const [show, setShow] = useState(false);
  const isSet = value === "••••••••";
  return (
    <div className="relative flex items-center">
      <Input
        id={id}
        type={show || isSet ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "sk-..."}
        className="pr-10 font-mono text-xs bg-background/50 border-border/40"
      />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: "configured" | "unconfigured" | "built_in" | "ok" | "error" | "testing" }) {
  return (
    <span className={cn("inline-flex size-2 rounded-full shrink-0",
      status === "configured" || status === "built_in" || status === "ok" ? "bg-emerald-400" :
      status === "unconfigured" || status === "error" ? "bg-red-400" :
      status === "testing" ? "bg-amber-400 animate-pulse" : "bg-muted"
    )} />
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <CheckCircle2 className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
    </button>
  );
}

function RoutingBadge({ routing }: { routing?: string }) {
  if (!routing) return null;
  return (
    <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider border",
      routing === "auto"    ? "bg-primary/10 text-primary border-primary/20" :
      routing === "fallback"? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
      "bg-muted text-muted-foreground border-border/30"
    )}>{routing}</span>
  );
}

// ── Section component ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, color, children, defaultOpen = true }: {
  title: string; icon: typeof Bot; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/30 bg-card/20 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors text-left">
        <div className={cn("size-8 rounded-xl flex items-center justify-center", color)}>
          <Icon className="size-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm flex-1">{title}</span>
        {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-border/20 pt-4">{children}</div>}
    </div>
  );
}

// ── Internal API rows ─────────────────────────────────────────────────────────

function InternalApiRow({ api, baseUrl }: { api: ApiEntry; baseUrl: string }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null);

  async function testEndpoint() {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(api.endpoint || "/", { method: api.endpoint?.includes("webhook") ? "GET" : "GET" });
      setTestResult(r.status < 500 ? "ok" : "error");
    } catch { setTestResult("error"); }
    setTesting(false);
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/10 last:border-0">
      <StatusDot status={testResult === "ok" ? "ok" : testResult === "error" ? "error" : "built_in"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold">{api.name}</p>
          <RoutingBadge routing={api.routing} />
          <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">{api.authType}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <code className="text-[10px] text-primary/70 font-mono">{baseUrl}{api.endpoint}</code>
          {api.endpoint && <CopyBtn text={`${baseUrl}${api.endpoint}`} />}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{api.description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {api.docs && <a href={api.docs} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-3" /></a>}
        <button onClick={testEndpoint} disabled={testing} className="text-[9px] px-2 py-1 rounded-lg border border-border/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
          {testing ? <Loader2 className="size-3 animate-spin" /> : "Ping"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ApiHubPage() {
  const fetchExtra = useServerFn(getExtraSettingsAdmin);
  const saveExtra = useServerFn(updateExtraSettings);
  const fetchAgent = useServerFn(getAgentSettings);
  const saveAgent = useServerFn(saveAgentSettings);
  const fetchMeta = useServerFn(getMetaCredentials);
  const saveMeta = useServerFn(updateMetaCredentials);
  const testAi = useServerFn(testAiConnection);

  const { data: extra } = useQuery({ queryKey: ["extra-settings"], queryFn: () => fetchExtra() });
  const { data: agent } = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchAgent() });
  const { data: meta } = useQuery({ queryKey: ["meta-creds"], queryFn: () => fetchMeta() });

  // AI / OrcaRouter state
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestOk, setAiTestOk] = useState<boolean | null>(null);

  // Meta state
  const [metaAppId, setMetaAppId] = useState("");
  const [metaSecret, setMetaSecret] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [metaPageId, setMetaPageId] = useState("");
  const [metaVerifyToken, setMetaVerifyToken] = useState("");

  // Voice state
  const [fishKey, setFishKey] = useState("");
  const [fishModelId, setFishModelId] = useState("");

  // Storage / B2 state
  const [b2Key, setB2Key] = useState("");
  const [bosonId, setBosonId] = useState("");

  // DO Inference state
  const [doKey, setDoKey] = useState("");

  // chat.b.ai Vision state
  const [chatbaiKey, setChatbaiKey] = useState("");
  const [chatbaiBaseUrl, setChatbaiBaseUrl] = useState("https://api.b.ai/v1");
  const [chatbaiModel, setChatbaiModel] = useState("deepseek-v4-flash-vision-exp");

  // Bytez state
  const [bytezKey, setBytezKey] = useState("");

  // Sync state
  const [syncToken, setSyncToken] = useState("");

  useEffect(() => {
    if (agent) { setAiBaseUrl(agent.ai_base_url ?? ""); setAiModel(agent.model ?? "qwen/qwen3.8-27b-free"); setAiKey(agent.lovable_api_key_override ?? ""); }
  }, [agent]);
  useEffect(() => {
    if (meta) { setMetaAppId(meta.appId ?? ""); setMetaSecret(meta.appSecret ?? ""); setMetaToken(meta.accessToken ?? ""); setMetaPageId(meta.pageId ?? ""); setMetaVerifyToken(meta.webhookVerifyToken ?? ""); }
  }, [meta]);
  useEffect(() => {
    if (extra) { setFishKey(extra.fishAudioApiKey ?? ""); setFishModelId(extra.fishAudioModelId ?? ""); setB2Key(extra.b2bBackblazeKey ?? ""); setBosonId(extra.bosonWorkspaceId ?? ""); setBytezKey(extra.bytezApiKey ?? ""); setDoKey((extra.altApiKeys as any)?.do_inference_key ?? ""); setChatbaiKey((extra.altApiKeys as any)?.chatbai_key ?? ""); setChatbaiBaseUrl((extra.altApiKeys as any)?.chatbai_base_url || "https://api.b.ai/v1"); setChatbaiModel((extra.altApiKeys as any)?.chatbai_model || "deepseek-v4-flash-vision-exp"); }
  }, [extra]);

  // Load on data change
  const [loaded, setLoaded] = useState({ agent: false, meta: false, extra: false });
  if (agent && !loaded.agent) { setAiBaseUrl(agent.ai_base_url ?? "https://api.orcarouter.ai/v1"); setAiModel(agent.model ?? "qwen/qwen3.8-27b-free"); setAiKey(agent.lovable_api_key_override ?? ""); setLoaded(l => ({ ...l, agent: true })); }
  if (meta && !loaded.meta) { setMetaAppId(meta.appId ?? ""); setMetaSecret(meta.appSecret ?? ""); setMetaToken(meta.accessToken ?? ""); setMetaPageId(meta.pageId ?? ""); setMetaVerifyToken(meta.webhookVerifyToken ?? ""); setLoaded(l => ({ ...l, meta: true })); }
  if (extra && !loaded.extra) { setFishKey(extra.fishAudioApiKey ?? ""); setFishModelId(extra.fishAudioModelId ?? ""); setB2Key(extra.b2bBackblazeKey ?? ""); setBosonId(extra.bosonWorkspaceId ?? ""); setBytezKey(extra.bytezApiKey ?? ""); setDoKey((extra.altApiKeys as any)?.do_inference_key ?? ""); setChatbaiKey((extra.altApiKeys as any)?.chatbai_key ?? ""); setChatbaiBaseUrl((extra.altApiKeys as any)?.chatbai_base_url || "https://api.b.ai/v1"); setChatbaiModel((extra.altApiKeys as any)?.chatbai_model || "deepseek-v4-flash-vision-exp"); setLoaded(l => ({ ...l, extra: true })); }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://daddyai.online";

  // Save AI
  async function saveAi() {
    try {
      await saveAgent({ data: { model: aiModel, lovable_api_key_override: aiKey, ai_base_url: aiBaseUrl } as any });
      toast.success("AI settings saved");
    } catch (e: any) { toast.error(e.message); }
  }

  // Test AI
  async function handleTestAi() {
    setAiTesting(true); setAiTestOk(null);
    try {
      const r = await testAi({ data: { ai_base_url: aiBaseUrl || undefined, ai_api_key: aiKey || undefined, model: aiModel || undefined } });
      setAiTestOk(r.ok);
      toast[r.ok ? "success" : "error"](r.ok ? `Connected (${r.model})` : r.error || "Failed");
    } catch (e: any) { setAiTestOk(false); toast.error(e.message); }
    setAiTesting(false);
  }

  // Save Meta
  async function saveMeta_() {
    try {
      await saveMeta({ data: { appId: metaAppId, appSecret: metaSecret, accessToken: metaToken, pageId: metaPageId, webhookVerifyToken: metaVerifyToken } });
      toast.success("Meta credentials saved");
    } catch (e: any) { toast.error(e.message); }
  }

  // Save extras
  async function saveVoice() {
    try {
      await saveExtra({ data: { fishAudioApiKey: fishKey, fishAudioModelId: fishModelId } });
      toast.success("Voice settings saved");
    } catch (e: any) { toast.error(e.message); }
  }
  async function saveStorage() {
    try {
      await saveExtra({ data: { b2bBackblazeKey: b2Key, bosonWorkspaceId: bosonId } });
      toast.success("Storage settings saved");
    } catch (e: any) { toast.error(e.message); }
  }
  async function saveDo() {
    try {
      const current = (extra?.altApiKeys as any) || {};
      await saveExtra({ data: { altApiKeys: { ...current, do_inference_key: doKey } } });
      toast.success("DO Inference key saved");
    } catch (e: any) { toast.error(e.message); }
  }
  async function saveChatBai() {
    try {
      const current = (extra?.altApiKeys as any) || {};
      await saveExtra({ data: { altApiKeys: { ...current, chatbai_key: chatbaiKey, chatbai_base_url: chatbaiBaseUrl, chatbai_model: chatbaiModel } } });
      toast.success("chat.b.ai vision settings saved");
    } catch (e: any) { toast.error(e.message); }
  }
  async function saveBytez() {
    try {
      await saveExtra({ data: { bytezApiKey: bytezKey } });
      toast.success("Bytez key saved");
    } catch (e: any) { toast.error(e.message); }
  }

  const FREE_MODELS = ["qwen/qwen3.8-27b-free", "deepseek/deepseek-v4-flash-free", "tencent/hy3-free"];
  const ALL_MODELS = [
    { id: "qwen/qwen3.8-27b-free", label: "Qwen 3.8 27B Free" },
    { id: "deepseek/deepseek-v4-flash-free", label: "DeepSeek V4 Flash Free" },
    { id: "tencent/hy3-free", label: "HunyuanLarge 3 Free" },
    { id: "orcarouter/fusion-mini", label: "Fusion Mini" },
    { id: "orcarouter/fusion-flash", label: "Fusion Flash" },
    { id: "orcarouter/auto", label: "Auto (smart route)" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "openai/gpt-4o", label: "GPT-4o" },
    { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
    { id: "mimo-v2.5", label: "MiMo V2.5 (legacy)" },
  ];

  const TASK_ROUTING = [
    { task: "Chat Reply",       model: "qwen/qwen3.8-27b-free",           cost: "FREE", reason: "Bengali fluency" },
    { task: "Sentiment",        model: "deepseek/deepseek-v4-flash-free",  cost: "FREE", reason: "Fast classification" },
    { task: "Lead Scoring",     model: "deepseek/deepseek-v4-flash-free",  cost: "FREE", reason: "Reasoning strength" },
    { task: "Pattern Extraction", model: "qwen/qwen3.8-27b-free",          cost: "FREE", reason: "Instruction following" },
    { task: "Auto Training",    model: "deepseek/deepseek-v4-flash-free",  cost: "FREE", reason: "Speed + accuracy" },
    { task: "Summarization",    model: "tencent/hy3-free",                 cost: "FREE", reason: "Concise output" },
    { task: "Vision / Image",   model: "kimi-k3 (DO Inference)",           cost: "DO",   reason: "Native vision model" },
  ];

  const isFreeModel = FREE_MODELS.includes(aiModel);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="size-6 text-primary" /> API Hub</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All backend + frontend APIs, keys, routing — one place</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            {INTERNAL_ROUTES.length} endpoints
          </span>
        </div>
      </div>

      {/* ── 1. AI Provider ─────────────────────────────────────────────────── */}
      <Section title="AI Provider — OrcaRouter / MiMo" icon={Sparkles} color="bg-violet-500" defaultOpen>
        {/* One-click OrcaRouter */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="text-xl"><Zap size={20} className="text-primary" /></span>
          <div className="flex-1">
            <p className="text-xs font-bold text-primary">OrcaRouter — 191 models, FREE tier included</p>
            <p className="text-[10px] text-muted-foreground">qwen/qwen3.8-27b-free · deepseek/deepseek-v4-flash-free · tencent/hy3-free</p>
          </div>
          <button onClick={() => { setAiBaseUrl("https://api.orcarouter.ai/v1"); setAiModel("qwen/qwen3.8-27b-free"); setAiKey(""); }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-black uppercase hover:bg-primary/90 transition-colors shrink-0">
            One-click
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Base URL</Label>
            <div className="flex gap-1.5">
              <Input value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)} placeholder="https://api.orcarouter.ai/v1" className="font-mono text-xs" />
              {["https://api.orcarouter.ai/v1", "https://api.xiaomimimo.com/v1", "https://api.openai.com/v1"].map(u => (
                <button key={u} onClick={() => setAiBaseUrl(u)} className="shrink-0 px-2 py-1 text-[9px] rounded-lg border border-border/30 hover:bg-muted/40 text-muted-foreground whitespace-nowrap">
                  {u.includes("orca") ? "OrcaRouter" : u.includes("mimo") ? "MiMo" : "OpenAI"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Model</Label>
            <select value={aiModel} onChange={e => setAiModel(e.target.value)} className="w-full h-9 text-xs bg-background border border-border/40 rounded-md px-2 font-mono">
              {ALL_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">API Key</Label>
          <MaskedInput value={aiKey} onChange={setAiKey} placeholder="sk-orca-... or sk-..." />
          {isFreeModel && <p className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><CheckCircle2 className="size-3" /> Free model selected — zero cost per call</p>}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={saveAi} className="h-8 text-xs gap-1.5"><Save className="size-3" /> Save</Button>
          <Button size="sm" variant="outline" onClick={handleTestAi} disabled={aiTesting} className="h-8 text-xs gap-1.5">
            {aiTesting ? <Loader2 className="size-3 animate-spin" /> : <Activity className="size-3" />} Test
          </Button>
          {aiTestOk !== null && <span className={cn("flex items-center gap-1 text-xs font-semibold", aiTestOk ? "text-emerald-400" : "text-red-400")}>{aiTestOk ? <><CheckCircle2 className="size-3.5" /> Connected</> : <><X className="size-3.5" /> Failed</>}</span>}
        </div>

        {/* Task routing table */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-black text-muted-foreground mb-2">Task → Model Routing (auto)</p>
          <div className="rounded-xl border border-border/20 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead><tr className="border-b border-border/20 bg-muted/20"><th className="text-left px-3 py-2 font-bold text-muted-foreground">Task</th><th className="text-left px-3 py-2 font-bold text-muted-foreground">Model</th><th className="text-left px-3 py-2 font-bold text-muted-foreground">Cost</th><th className="text-left px-3 py-2 font-bold text-muted-foreground">Reason</th></tr></thead>
              <tbody>
                {TASK_ROUTING.map((r, i) => (
                  <tr key={r.task} className={cn("border-b border-border/10 last:border-0", i % 2 === 0 ? "bg-muted/5" : "")}>
                    <td className="px-3 py-1.5 font-semibold">{r.task}</td>
                    <td className="px-3 py-1.5 font-mono text-primary/80">{r.model}</td>
                    <td className="px-3 py-1.5"><span className={cn("px-1.5 py-0.5 rounded-full text-[8px] font-black border", r.cost === "FREE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20")}>{r.cost}</span></td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">Fallback chain: OrcaRouter Free → OrcaRouter Fusion-Mini → MiMo</p>
        </div>
      </Section>

      {/* ── 2. Meta / Facebook ─────────────────────────────────────────────── */}
      <Section title="Meta — Facebook / Instagram / WhatsApp" icon={MessageSquare} color="bg-blue-500">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "App ID", value: metaAppId, set: setMetaAppId, ph: "1109026741454743" },
            { label: "App Secret", value: metaSecret, set: setMetaSecret, ph: "••••••••" },
            { label: "Page Access Token", value: metaToken, set: setMetaToken, ph: "EAABwzLixnjYBO..." },
            { label: "Page ID", value: metaPageId, set: setMetaPageId, ph: "12345678" },
          ].map(f => (
            <div key={f.label} className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">{f.label}</Label>
              <MaskedInput value={f.value} onChange={f.set} placeholder={f.ph} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Webhook Verify Token</Label>
            <Input value={metaVerifyToken} onChange={e => setMetaVerifyToken(e.target.value)} placeholder="daddyai_webhook_2026" className="font-mono text-xs" />
          </div>
        </div>
        <div className="space-y-1 mt-1">
          <p className="text-[10px] text-muted-foreground font-semibold">Webhook URL (copy to Meta Developer Console):</p>
          <div className="flex items-center gap-2">
            <code className="text-[11px] text-primary/80 font-mono flex-1 truncate">{baseUrl}/api/public/webhooks/meta</code>
            <CopyBtn text={`${baseUrl}/api/public/webhooks/meta`} />
          </div>
        </div>
        <Button size="sm" onClick={saveMeta_} className="h-8 text-xs gap-1.5 mt-2"><Save className="size-3" /> Save Meta</Button>
      </Section>

      {/* ── 3. Voice ───────────────────────────────────────────────────────── */}
      <Section title="Voice — Fish Audio / MiMo TTS" icon={Zap} color="bg-pink-500" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Fish Audio API Key</Label>
            <MaskedInput value={fishKey} onChange={setFishKey} placeholder="fish_sk_..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Fish Audio Model / Voice ID</Label>
            <Input value={fishModelId} onChange={e => setFishModelId(e.target.value)} placeholder="Model ID or Voice clone ID" className="font-mono text-xs" />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
          <p className="text-[10px] font-bold text-muted-foreground mb-1">Fallback chain</p>
          <p className="text-[11px] text-foreground">Fish Audio → MiMo TTS → Bytez ASR (transcription fallback)</p>
        </div>
        <Button size="sm" onClick={saveVoice} className="h-8 text-xs gap-1.5"><Save className="size-3" /> Save Voice</Button>
      </Section>

      {/* ── 4. Vision / DO Inference ───────────────────────────────────────── */}
      <Section title="Vision — chat.b.ai / DO Inference / Bytez" icon={Globe} color="bg-teal-500" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">chat.b.ai API Key</Label>
            <MaskedInput value={chatbaiKey} onChange={setChatbaiKey} placeholder="sk-..." />
            <p className="text-[10px] text-muted-foreground">Vision model: deepseek-v4-flash-vision-exp</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Base URL (optional)</Label>
            <Input value={chatbaiBaseUrl} onChange={e => setChatbaiBaseUrl(e.target.value)} placeholder="https://api.b.ai/v1" className="font-mono text-xs" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">DO Inference Key</Label>
            <MaskedInput value={doKey} onChange={setDoKey} placeholder="dop_v1_..." />
            <p className="text-[10px] text-muted-foreground">Fallback vision (kimi-k3) and Whisper transcription</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Bytez API Key</Label>
            <MaskedInput value={bytezKey} onChange={setBytezKey} placeholder="bytez_..." />
            <p className="text-[10px] text-muted-foreground">Final fallback vision + ASR</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
          <p className="text-[10px] font-bold text-muted-foreground mb-1">Vision fallback chain</p>
          <p className="text-[11px]">chat.b.ai deepseek-v4-flash-vision-exp → DO kimi-k3 → OpenAI gpt-4o → Bytez</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={saveChatBai} className="h-8 text-xs gap-1.5"><Save className="size-3" /> Save chat.b.ai</Button>
          <Button size="sm" onClick={saveDo} className="h-8 text-xs gap-1.5"><Save className="size-3" /> Save DO Key</Button>
          <Button size="sm" onClick={saveBytez} className="h-8 text-xs gap-1.5"><Save className="size-3" /> Save Bytez Key</Button>
        </div>
      </Section>

      {/* ── 5. Storage / B2 ──────────────────────────────────────────────────── */}
      <Section title="Storage — Backblaze B2 / Boson AI" icon={Database} color="bg-amber-500" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Backblaze B2 Key</Label>
            <MaskedInput value={b2Key} onChange={setB2Key} placeholder="keyId:applicationKey" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Boson AI Workspace ID</Label>
            <Input value={bosonId} onChange={e => setBosonId(e.target.value)} placeholder="ws_..." className="font-mono text-xs" />
          </div>
        </div>
        <Button size="sm" onClick={saveStorage} className="h-8 text-xs gap-1.5"><Save className="size-3" /> Save Storage</Button>
      </Section>

      {/* ── 6. Internal endpoints ─────────────────────────────────────────── */}
      <Section title="Internal API Endpoints" icon={Server} color="bg-muted-foreground" defaultOpen={false}>
        <div className="space-y-0">
          {INTERNAL_ROUTES.map(api => <InternalApiRow key={api.id} api={api} baseUrl={baseUrl} />)}
        </div>
      </Section>

      {/* ── 7. MCP ────────────────────────────────────────────────────────── */}
      <Section title="MCP — Model Context Protocol" icon={Terminal} color="bg-emerald-600" defaultOpen={false}>
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-muted/20 border border-border/20 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold">MCP Endpoint</p>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-black">JSON-RPC 2.0</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono text-primary/80 flex-1">{baseUrl}/mcp</code>
              <CopyBtn text={`${baseUrl}/mcp`} />
            </div>
          </div>
          {[
            { tool: "search_products", desc: "Semantic product search by keyword, stock, category" },
            { tool: "get_training_stats", desc: "Training pair counts, confidence score, last sync" },
            { tool: "add_training_pair", desc: "Add approved Q&A training pair" },
            { tool: "trigger_sync", desc: "Kick off product catalog sync" },
            { tool: "get_conversations", desc: "Recent conversations for analysis" },
            { tool: "auto_train", desc: "Run one auto-training cycle" },
            { tool: "get_backup", desc: "Get or generate latest backup bundle" },
          ].map(t => (
            <div key={t.tool} className="flex items-start gap-2 py-1.5 border-b border-border/10 last:border-0">
              <code className="text-[10px] font-mono text-primary/80 w-40 shrink-0">{t.tool}</code>
              <p className="text-[10px] text-muted-foreground">{t.desc}</p>
            </div>
          ))}
          <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
            <p className="text-[10px] font-bold text-muted-foreground mb-1">Usage (Claude / cursor / any MCP client)</p>
            <code className="text-[10px] font-mono text-primary/70 block whitespace-pre">{`{
  "mcpServers": {
    "daddyai": {
      "url": "${baseUrl}/mcp",
      "transport": "http"
    }
  }
}`}</code>
          </div>
        </div>
      </Section>

      {/* ── 8. Sync / Webhooks ───────────────────────────────────────────── */}
      <Section title="Sync & Webhook Tokens" icon={Webhook} color="bg-orange-500" defaultOpen={false}>
        <div className="space-y-3">
          {[
            { label: "Sync Token (SYNC_TOKEN)", key: "sync_token", hint: "Used to authenticate product sync from WearImpressive" },
            { label: "Sync Secret (SYNC_SECRET)", key: "sync_secret", hint: "HMAC secret for sync request verification" },
            { label: "Webhook Secret (WEBHOOK_SECRET)", key: "webhook_secret", hint: "Verifies incoming generic webhooks" },
            { label: "Cron Secret (CRON_SECRET)", key: "cron_secret", hint: "Authorization for cron endpoints" },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">{f.label}</Label>
              <div className="flex items-center gap-2">
                <code className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/20 flex-1 truncate">Set in ecosystem.config.cjs / server env</code>
              </div>
              <p className="text-[9px] text-muted-foreground">{f.hint}</p>
            </div>
          ))}
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold"><AlertTriangle className="size-3.5" /> These tokens live in ecosystem.config.cjs on the VPS.</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">SSH to 143.198.29.180 and edit /var/www/daddyai/ecosystem.config.cjs to rotate them, then run <code className="font-mono">pm2 reload daddyai --update-env</code></p>
          </div>
        </div>
      </Section>
    </div>
  );
}
