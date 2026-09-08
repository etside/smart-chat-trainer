import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getExtraSettingsAdmin,
  updateExtraSettings,
  getPendingDrafts,
  approveDraft,
  regenerateDraft,
  dismissDraft,
} from "@/lib/extra-settings.functions";
import { getStats, getMyRole } from "@/lib/console.functions";
import { listTemplates, saveTemplate, deleteTemplate } from "@/lib/auto-replies.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Zap, Clock, MessageSquare, Sparkles, Loader2, Check, X,
  Gauge, Bot, Users, BarChart3, TrendingUp, TrendingDown,
  ShieldCheck, Edit2, Trash2, Plus, Globe, Layout, ImageIcon,
  AlertTriangle, ChevronDown, ChevronUp, HeartPulse,
  Activity, RefreshCw, ThumbsUp, ThumbsDown, Eye,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/responsiveness")({
  component: ResponsivenessPage,
});

type AutoReplyMode = "on" | "off" | "standby";

const modeConfig: Record<AutoReplyMode, { label: string; desc: string; color: string }> = {
  on:     { label: "Auto-Reply ON",    desc: "AI automatically replies to all messages",     color: "text-emerald-400" },
  off:    { label: "Auto-Reply OFF",   desc: "AI drafts replies — review & send manually",  color: "text-muted-foreground" },
  standby:{ label: "Standby",          desc: "AI drafts for priority messages only",          color: "text-amber-400" },
};

function ResponsivenessPage() {
  const qc = useQueryClient();
  const fetchExtra = useServerFn(getExtraSettingsAdmin);
  const updateExtra = useServerFn(updateExtraSettings);
  const fetchStats = useServerFn(getStats);
  const fetchMyRole = useServerFn(getMyRole);
  const fetchTemplates = useServerFn(listTemplates);
  const saveTemplateFn = useServerFn(saveTemplate);
  const deleteTemplateFn = useServerFn(deleteTemplate);
  const getDraftsFn = useServerFn(getPendingDrafts);
  const approveFn = useServerFn(approveDraft);
  const regenFn = useServerFn(regenerateDraft);
  const dismissFn = useServerFn(dismissDraft);

  const [autoReplyMode, setAutoReplyMode] = useState<AutoReplyMode>("off");
  const [autoApprove, setAutoApprove] = useState(false);
  const [responseTimeTarget, setResponseTimeTarget] = useState(30);
  const [greetingEnabled, setGreetingEnabled] = useState(true);
  const [greetingMessage, setGreetingMessage] = useState("স্বাগতম! আমি Daddy AI, আপনার সেলস অ্যাসিস্ট্যান্ট। কীভাবে সাহায্য করতে পারি?");
  const [offlineMessage, setOfflineMessage] = useState("ধন্যবাদ! আমরা শীঘ্রই আপনার মেসেজের উত্তর দেবো।");
  const [workingHours, setWorkingHours] = useState("24/7");
  const [maxAutoReplyLength, setMaxAutoReplyLength] = useState(500);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"overview" | "templates" | "drafts">("overview");

  // Queries
  const { data: extraData, isLoading: extraLoading } = useQuery({
    queryKey: ["extra-settings-admin"],
    queryFn: () => fetchExtra(),
    staleTime: 30_000,
  });

  // Sync loaded auto-reply mode into local state (TanStack Query v5 has no onSuccess)
  const prevModeRef = useRef<AutoReplyMode | null>(null);
  if (extraData?.autoReplyMode && extraData?.autoReplyMode !== prevModeRef.current) {
    prevModeRef.current = extraData.autoReplyMode;
    setAutoReplyMode(extraData.autoReplyMode);
  }

  const { data: statsData } = useQuery({
    queryKey: ["stats-overview"],
    queryFn: () => fetchStats(),
    staleTime: 30_000,
  });

  const { data: roleData } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchMyRole(),
    staleTime: 60_000,
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["auto-reply-templates"],
    queryFn: () => fetchTemplates(),
    enabled: selectedTab === "templates",
    staleTime: 30_000,
  });

  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["pendingDrafts"],
    queryFn: () => getDraftsFn(),
    enabled: selectedTab === "drafts",
    refetchInterval: 15_000,
  });

  const canEdit = roleData?.role === "admin" || roleData?.role === "editor";

  // Mutations
  const saveExtraMutation = useMutation({
    mutationFn: (data: any) => updateExtra({ data }),
    onSuccess: () => { toast.success("Responsiveness settings saved"); qc.invalidateQueries({ queryKey: ["extra-settings-admin"] }); },
    onError: () => toast.error("Failed to save settings"),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (data: any) => saveTemplateFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-reply-templates"] });
      toast.success("Template saved");
      setEditingTemplate(null);
      setIsNewTemplate(false);
    },
    onError: () => toast.error("Failed to save template"),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => deleteTemplateFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["auto-reply-templates"] }); toast.success("Template deleted"); },
  });

  const approveDraftMutation = useMutation({
    mutationFn: (logId: string) => approveFn({ data: { logId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pendingDrafts"] }); toast.success("Draft approved & sent"); },
  });

  const regenDraftMutation = useMutation({
    mutationFn: (logId: string) => regenFn({ data: { logId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pendingDrafts"] }); toast.success("Draft regenerated"); },
  });

  const dismissDraftMutation = useMutation({
    mutationFn: (logId: string) => dismissFn({ data: { logId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pendingDrafts"] }); toast.success("Draft dismissed"); },
  });

  const handleModeChange = (mode: AutoReplyMode) => {
    setAutoReplyMode(mode);
    saveExtraMutation.mutate({ autoReplyMode: mode });
  };

  const handleSaveResponsiveness = () => {
    saveExtraMutation.mutate({
      autoReplyMode,
    });
  };

  const metrics = [
    {
      label: "Avg Response Time",
      value: "1.2s",
      trend: "up",
      change: "25%",
      icon: Clock,
      color: "text-emerald-400",
    },
    {
      label: "Auto-Reply Rate",
      value: `${statsData?.approved ?? 0}%`,
      trend: "up",
      change: "8%",
      icon: Zap,
      color: "text-blue-400",
    },
    {
      label: "Active Templates",
      value: templates?.length ?? 0,
      trend: "neutral",
      icon: MessageSquare,
      color: "text-purple-400",
    },
    {
      label: "Pending Drafts",
      value: drafts?.length ?? 0,
      trend: drafts?.length > 0 ? "down" : "neutral",
      icon: AlertTriangle,
      color: drafts?.length > 0 ? "text-amber-400" : "text-muted-foreground",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HeartPulse className="size-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Responsiveness</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground ml-[52px]">
            Manage auto-reply behavior, response speed, and customer engagement rules.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleSaveResponsiveness} className="gap-1.5" disabled={saveExtraMutation.isPending}>
          {saveExtraMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save Settings
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
              <m.icon className={cn("size-3", m.color)} /> {m.label}
            </div>
            <p className="text-2xl font-bold tracking-tight">{m.value}</p>
            {m.trend !== "neutral" && (
              <div className="flex items-center gap-1 mt-1">
                {m.trend === "up" ? <TrendingUp className="size-3 text-emerald-400" /> : <TrendingDown className="size-3 text-red-400" />}
                <span className="text-[10px] text-muted-foreground">{m.change}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-muted/30 border border-border/20 w-fit">
        {(["overview", "templates", "drafts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
              selectedTab === tab
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {tab === "overview" && <Gauge className="size-3.5 inline mr-1.5" />}
            {tab === "templates" && <MessageSquare className="size-3.5 inline mr-1.5" />}
            {tab === "drafts" && <Eye className="size-3.5 inline mr-1.5" />}
            {tab === "overview" ? "Overview" : tab === "templates" ? "Templates" : "Pending Drafts"}
          </button>
        ))}
      </div>

      {/* ════════════════ TAB: OVERVIEW ════════════════ */}
      {selectedTab === "overview" && (
        <div className="space-y-6">
          {/* Auto-Reply Mode */}
          <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Auto-Reply Mode</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["on", "off", "standby"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  disabled={!canEdit}
                  className={cn(
                    "flex-1 min-w-[140px] p-4 rounded-xl border-2 transition-all",
                    autoReplyMode === mode
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border/20 bg-muted/10 hover:border-border/40 hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "size-2.5 rounded-full",
                      mode === "on" ? "bg-emerald-500" : mode === "off" ? "bg-muted-foreground" : "bg-amber-500"
                    )} />
                    <span className="font-bold text-sm">{modeConfig[mode].label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{modeConfig[mode].desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Response Settings */}
          <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Response Configuration</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                    <Clock className="size-3 inline mr-1" /> Target Response Time
                  </Label>
                  <span className="text-sm font-bold">{responseTimeTarget}s</span>
                </div>
                <Slider
                  value={[responseTimeTarget]}
                  onValueChange={([v]) => setResponseTimeTarget(v)}
                  min={5}
                  max={300}
                  step={5}
                  disabled={!canEdit}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>5s</span>
                  <span>5min</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                    <Zap className="size-3 inline mr-1" /> Auto-Approve
                  </Label>
                  <Switch checked={autoApprove} onCheckedChange={setAutoApprove} disabled={!canEdit} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  When enabled, AI-approved replies are sent immediately without manual review.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                    <MessageSquare className="size-3 inline mr-1" /> Max Reply Length
                  </Label>
                  <span className="text-sm font-bold">{maxAutoReplyLength}</span>
                </div>
                <Slider
                  value={[maxAutoReplyLength]}
                  onValueChange={([v]) => setMaxAutoReplyLength(v)}
                  min={100}
                  max={2000}
                  step={50}
                  disabled={!canEdit}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>100 chars</span>
                  <span>2000 chars</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                    <Globe className="size-3 inline mr-1" /> Working Hours
                  </Label>
                </div>
                <Select value={workingHours} onValueChange={setWorkingHours} disabled={!canEdit}>
                  <SelectTrigger className="bg-muted/20 border-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24/7">24/7 (Always On)</SelectItem>
                    <SelectItem value="business">Business Hours (9AM-6PM)</SelectItem>
                    <SelectItem value="custom">Custom Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Greeting Messages */}
          <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <h2 className="text-lg font-bold">Greeting & Offline Messages</h2>
              </div>
              <Switch checked={greetingEnabled} onCheckedChange={setGreetingEnabled} disabled={!canEdit} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                  <Bot className="size-3 inline mr-1" /> Welcome Message
                </Label>
                <Textarea
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  rows={3}
                  disabled={!greetingEnabled || !canEdit}
                  className="bg-muted/20 border-white/5"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                  <Users className="size-3 inline mr-1" /> Offline Message
                </Label>
                <Textarea
                  value={offlineMessage}
                  onChange={(e) => setOfflineMessage(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  className="bg-muted/20 border-white/5"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ TAB: TEMPLATES ════════════════ */}
      {selectedTab === "templates" && (
        <div className="space-y-6">
          {/* New / Edit Template Form */}
          {(isNewTemplate || editingTemplate) && (
            <div className="panel p-6 bg-card/40 backdrop-blur-sm border-primary/20 border-t-4 border-t-primary animate-in slide-in-from-top-2">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                {editingTemplate ? <Edit2 className="size-4 text-primary" /> : <Plus className="size-4 text-primary" />}
                {editingTemplate ? "Edit Template" : "New Template"}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  saveTemplateMutation.mutate({
                    id: editingTemplate?.id,
                    name: fd.get("name"),
                    platform: fd.get("platform"),
                    language: fd.get("language"),
                    template_text: fd.get("template_text"),
                    image_url: (fd.get("image_url") as string) || undefined,
                    caption: (fd.get("caption") as string) || undefined,
                    trigger_keywords: (fd.get("trigger_keywords") as string || "")
                      .split(",").map((k) => k.trim()).filter(Boolean),
                    variables: [],
                    publish: true,
                  });
                }}
                className="grid gap-4 md:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Name</Label>
                  <Input name="name" defaultValue={editingTemplate?.name} placeholder="Welcome Message" required className="bg-muted/20" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Platform</Label>
                  <Select name="platform" defaultValue={editingTemplate?.platform || "messenger"}>
                    <SelectTrigger className="bg-muted/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="messenger">Messenger</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="web">Website Chat</SelectItem>
                      <SelectItem value="all">All Platforms</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Language</Label>
                  <Select name="language" defaultValue={editingTemplate?.language || "bn"}>
                    <SelectTrigger className="bg-muted/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bn">Bengali</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="banglish">Banglish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                    <ImageIcon className="size-3 inline mr-1" /> Media URL (optional)
                  </Label>
                  <Input name="image_url" type="url" defaultValue={editingTemplate?.image_url} placeholder="https://..." className="bg-muted/20" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Template Text *</Label>
                  <Textarea name="template_text" defaultValue={editingTemplate?.template_text} rows={3} required className="bg-muted/20" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                    <Zap className="size-3 inline mr-1" /> Trigger Keywords (comma separated)
                  </Label>
                  <Input name="trigger_keywords" defaultValue={editingTemplate?.trigger_keywords?.join(", ")} placeholder="price, দাম, order" className="bg-muted/20" />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saveTemplateMutation.isPending} className="gap-1.5">
                    {saveTemplateMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setEditingTemplate(null); setIsNewTemplate(false); }} className="gap-1.5">
                    <X className="size-3.5" /> Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Templates Grid */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" /> Auto-Reply Templates
            </h2>
            {!isNewTemplate && !editingTemplate && canEdit && (
              <Button size="sm" onClick={() => setIsNewTemplate(true)} className="gap-1.5">
                <Plus className="size-3.5" /> New Template
              </Button>
            )}
          </div>

          {templatesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates?.map((t: any) => (
                <div key={t.id} className="panel p-5 bg-card/40 backdrop-blur-sm border-white/5 hover:border-primary/20 transition-all flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="size-4 text-primary" />
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingTemplate(t)}>
                          <Edit2 className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => {
                          if (confirm("Delete this template?")) deleteTemplateMutation.mutate(t.id);
                        }}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold mb-1">{t.name}</h3>
                  <div className="flex gap-1.5 mb-2">
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                      t.status === "published" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border/30"
                    )}>{t.status || "draft"}</span>
                    <span className="flex items-center gap-1 text-[9px] uppercase font-black bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      <Layout className="size-2.5" /> {t.platform}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] uppercase font-black bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      <Globe className="size-2.5" /> {t.language}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3 italic">"{t.template_text}"</p>
                  {t.image_url && (
                    <div className="relative rounded-xl overflow-hidden border border-border/30 mb-2">
                      <img src={t.image_url} alt="" className="w-full h-20 object-cover" />
                    </div>
                  )}
                  {t.trigger_keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-border/20">
                      {t.trigger_keywords.slice(0, 3).map((kw: string) => (
                        <span key={kw} className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold border border-primary/20">{kw}</span>
                      ))}
                      {t.trigger_keywords.length > 3 && <span className="text-[9px] text-muted-foreground">+{t.trigger_keywords.length - 3}</span>}
                    </div>
                  )}
                </div>
              ))}
              {templates?.length === 0 && !isNewTemplate && (
                <div className="col-span-full py-16 text-center panel bg-muted/20 border-dashed">
                  <MessageSquare className="size-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                  <p className="text-muted-foreground">No templates yet. Create your first auto-reply template.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ TAB: PENDING DRAFTS ════════════════ */}
      {selectedTab === "drafts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Eye className="size-4 text-primary" /> Pending Draft Reviews
            </h2>
            <Button size="sm" variant="ghost" className="text-[10px] gap-1" onClick={() => qc.invalidateQueries({ queryKey: ["pendingDrafts"] })}>
              <RefreshCw className="size-3" /> Refresh
            </Button>
          </div>

          {draftsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : drafts?.length === 0 ? (
            <div className="panel p-12 text-center bg-muted/20 border-dashed">
              <MessageSquare className="size-12 mx-auto text-muted-foreground opacity-20 mb-4" />
              <p className="text-muted-foreground font-medium">No pending drafts — all caught up!</p>
              <p className="text-[10px] text-muted-foreground mt-1">New auto-replies will appear here for review.</p>
            </div>
          ) : (
            drafts?.map((draft: any) => (
              <div key={draft.id} className="panel p-5 bg-card/40 backdrop-blur-sm border-white/5 hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-black">Draft</Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">{draft.id?.slice(0, 8)}…</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {draft.created_at ? new Date(draft.created_at).toLocaleString("bn-BD") : "—"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{draft.content || draft.message || JSON.stringify(draft.payload || draft).slice(0, 300)}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 text-[11px] h-7" onClick={() => approveDraftMutation.mutate(draft.id)} disabled={approveDraftMutation.isPending}>
                    <ThumbsUp className="size-3" /> Approve & Send
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-[11px] h-7" onClick={() => regenDraftMutation.mutate(draft.id)} disabled={regenDraftMutation.isPending}>
                    <RefreshCw className="size-3" /> Regenerate
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-[11px] h-7 text-destructive" onClick={() => dismissDraftMutation.mutate(draft.id)} disabled={dismissDraftMutation.isPending}>
                    <ThumbsDown className="size-3" /> Dismiss
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}