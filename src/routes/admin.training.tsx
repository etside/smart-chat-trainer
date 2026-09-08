import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  deletePair,
  getLabelCounts,
  listPairs,
  savePair,
  setPairStatus,
  updateTrainingPairLabel,
  getStats,
  exportTrainingData,
  triggerTraining,
  getTrainingJobs,
  getTrainingJobDetail,
} from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check, Download, Loader2, Pencil, Trash2, X, Search, Filter,
  Database, Sparkles, Brain, ChevronDown, ChevronUp, Plus,
  RefreshCw, Clock, ShieldCheck, AlertTriangle, FileText,
  BarChart3, ArrowUpDown, Zap, BookOpen, Target, Layers,
  MessageSquare, Eye, EyeOff, Upload, Copy, Terminal,
  Activity, TrendingUp, TrendingDown, Minus, Info,
  CheckCircle, XCircle, HelpCircle
} from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/training")({
  component: TrainingData,
});

type Status = "all" | "approved" | "pending" | "rejected";

const LABELS = [
  { value: "LEAD", bg: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "SOLD", bg: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "Support", bg: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "Spam", bg: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "Other", bg: "bg-muted/50 text-muted-foreground border-border/30" },
] as const;

function labelStyle(value: string) {
  return LABELS.find((l) => l.value === value)?.bg ?? "bg-muted/50 text-muted-foreground border-border/30";
}

function TrainingData() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: string; question: string; answer: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importText, setImportText] = useState("");
  const [showStats, setShowStats] = useState(true);
  const [showJobPanel, setShowJobPanel] = useState(false);

  const fetchPairs = useServerFn(listPairs);
  const save = useServerFn(savePair);
  const setStatusFn = useServerFn(setPairStatus);
  const remove = useServerFn(deletePair);
  const updateLabel = useServerFn(updateTrainingPairLabel);
  const fetchLabelCounts = useServerFn(getLabelCounts);
  const fetchStats = useServerFn(getStats);
  const exportData = useServerFn(exportTrainingData);
  const triggerTrain = useServerFn(triggerTraining);
  const fetchJobs = useServerFn(getTrainingJobs);

  const { data, isLoading } = useQuery({
    queryKey: ["pairs", term, status, page],
    queryFn: () => fetchPairs({ data: { search: term, status, page } }),
  });

  const { data: labelCounts } = useQuery({
    queryKey: ["label-counts"],
    queryFn: () => fetchLabelCounts(),
    staleTime: 30_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["stats-overview"],
    queryFn: () => fetchStats(),
    staleTime: 60_000,
  });

  const { data: jobs } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: () => fetchJobs(),
    staleTime: 30_000,
    enabled: showJobPanel,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["pairs"] });
    qc.invalidateQueries({ queryKey: ["stats-overview"] });
  }, [qc]);

  const saveMutation = useMutation({
    mutationFn: (v: { id: string; question: string; answer: string }) => save({ data: v }),
    onSuccess: () => { setEditing(null); toast.success("আপডেট হয়েছে"); invalidate(); },
    onError: () => toast.error("সেভ করা যায়নি।"),
  });

  const statusMutation = useMutation({
    mutationFn: (v: { ids: string[]; status: "approved" | "pending" | "rejected" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => { toast.success("স্ট্যাটাস আপডেট হয়েছে"); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); setDeletingId(null); invalidate(); },
  });

  const labelMutation = useMutation({
    mutationFn: (v: { id: string; labels: string[] }) => updateLabel({ data: v }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["label-counts"] }); },
    onError: () => toast.error("লেবেল সেভ হয়নি।"),
  });

  const triggerMutation = useMutation({
    mutationFn: () => triggerTrain({ data: {} }),
    onSuccess: (res: any) => {
      toast.success(`ট্রেনিং শুরু হয়েছে (Job: ${res.job_id?.slice(0, 8)}…)`);
      qc.invalidateQueries({ queryKey: ["training-jobs"] });
    },
    onError: () => toast.error("ট্রেনিং ট্রিগার করতে ব্যর্থ।"),
  });

  function toggleLabel(rowId: string, currentLabels: string[], label: string) {
    const next = currentLabels.includes(label)
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];
    labelMutation.mutate({ id: rowId, labels: next });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const rows = data?.rows ?? [];
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r: any) => r.id)));
    }
  }

  function bulkAction(status: "approved" | "pending" | "rejected") {
    if (selectedIds.size === 0) { toast.error("কোনো আইটেম সিলেক্ট করা হয়নি।"); return; }
    statusMutation.mutate({ ids: Array.from(selectedIds), status });
    setSelectedIds(new Set());
  }

  function exportCSV() {
    const rows = data?.rows ?? [];
    if (!rows.length) { toast.error("কোনো ডেটা নেই।"); return; }
    const header = ["id", "question", "answer", "status", "labels", "created_at"];
    const csvRows = [
      header.join(","),
      ...rows.map((r: any) =>
        [
          r.id,
          `"${(r.question ?? "").replace(/"/g, '""')}"`,
          `"${(r.answer ?? "").replace(/"/g, '""')}"`,
          r.status,
          `"${(r.labels ?? []).join("|")}"`,
          r.created_at,
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-pairs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} টি রেকর্ড এক্সপোর্ট করা হয়েছে`);
  }

  async function handleExportJSON() {
    const res = await exportData({ data: { type: "training_pairs" } });
    const blob = new Blob([res.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-pairs-full-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("সম্পূর্ণ ডেটা JSON এক্সপোর্ট করা হয়েছে");
  }

  const total = data?.total ?? 0;
  const size = data?.size ?? 25;
  const maxPage = Math.max(0, Math.ceil(total / size) - 1);

  const countFor = (label: string) =>
    (labelCounts as any[])?.find((l: any) => l.label === label)?.count ?? 0;

  // Confidence score from stats
  const approvedCount = statsData?.approved ?? 0;
  const totalMessages = statsData?.messages ?? 0;
  const confidenceScore = totalMessages > 0
    ? Math.round((approvedCount / (totalMessages * 0.5)) * 100) / 100
    : 0;
  const confidencePercent = Math.min(Math.round(confidenceScore * 100), 100);

  const statusBadge = (status: string) => {
    switch (status) {
      case "running": return <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><Loader2 className="size-2.5 inline animate-spin mr-1" />Running</span>;
      case "completed": return <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completed</span>;
      case "failed": return <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Failed</span>;
      default: return <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground border-border/30">{status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-20 animate-in fade-in duration-500">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="size-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">ট্রেনিং ডেটা</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground ml-[52px]">
            এজেন্ট এই প্রশ্ন-উত্তরগুলো দেখে উত্তর সাজায়। যত বেশি কভারেজ, তত ভালো রেসপন্স।
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setShowJobPanel(!showJobPanel)} className="gap-1.5">
            <Activity className="size-3.5" /> Jobs
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="gap-1.5"
          >
            {triggerMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            ট্রেনিং রান
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5">
            <Download className="size-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportJSON} className="gap-1.5">
            <FileText className="size-3.5" /> JSON
          </Button>
        </div>
      </div>

      {/* ── Stats Dashboard Row ────────────────────────────────────── */}
      {showStats && statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
              <Database className="size-3" /> Approved Pairs
            </div>
            <p className="text-2xl font-bold tracking-tight">{statsData.approved.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">{statsData.pending} pending</span>
              <span className="text-[10px] text-muted-foreground mx-1">·</span>
              <span className="text-[10px] text-muted-foreground">{statsData.rejected} rejected</span>
            </div>
          </div>
          <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
              <MessageSquare className="size-3" /> Conversations
            </div>
            <p className="text-2xl font-bold tracking-tight">{statsData.conversations.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">{statsData.messages.toLocaleString()} messages</span>
            </div>
          </div>
          <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
              <Target className="size-3" /> Confidence
            </div>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold tracking-tight">{confidencePercent}%</p>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    confidencePercent > 70 ? "bg-emerald-500" :
                    confidencePercent > 40 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {confidencePercent < 50 ? (
                <TrendingDown className="size-3 text-red-400" />
              ) : confidencePercent < 80 ? (
                <Minus className="size-3 text-amber-400" />
              ) : (
                <TrendingUp className="size-3 text-emerald-400" />
              )}
              <span className="text-[10px] text-muted-foreground">
                {confidencePercent < 50 ? "Need more data" : confidencePercent < 80 ? "Building coverage" : "Strong coverage"}
              </span>
            </div>
          </div>
          <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
              <Zap className="size-3" /> Leads
            </div>
            <p className="text-2xl font-bold tracking-tight">{statsData.hotLeads.toLocaleString()}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">{statsData.warmLeads} warm</span>
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-bold">{statsData.coldLeads} cold</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Training Jobs Panel ────────────────────────────────────── */}
      {showJobPanel && (
        <div className="panel p-5 bg-card/40 backdrop-blur-sm border-primary/10 mb-6 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Training Jobs
            </h3>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowJobPanel(false)}>
              <X className="size-3" /> বন্ধ
            </Button>
          </div>
          <div className="space-y-2">
            {jobs?.length === 0 && <p className="text-xs text-muted-foreground italic">কোনো ট্রেনিং জব নেই।</p>}
            {jobs?.slice(0, 5).map((job: any) => (
              <div key={job.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-white/5">
                <div className="flex items-center gap-3">
                  {statusBadge(job.status)}
                  <span className="text-[10px] font-mono text-muted-foreground">{job.id?.slice(0, 8)}…</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {job.created_at ? new Date(job.created_at).toLocaleString("bn-BD") : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Import Panel ───────────────────────────────────────────── */}
      {showImportPanel && (
        <div className="panel p-5 bg-card/40 backdrop-blur-sm border-indigo-500/20 mb-6 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Upload className="size-4 text-indigo-400" /> Bulk Import
            </h3>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowImportPanel(false)}>
              <X className="size-3" /> বন্ধ
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            JSON array of Q&A objects: <code className="text-primary">[{"{\"question\":\"...\",\"answer\":\"...\"}"}]</code>
          </p>
          <Textarea
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[{"question":"দাম কত?","answer":"মাত্র ৳৪৯৯!"}]'
            className="font-mono text-xs bg-muted/20"
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" disabled={!importText.trim()} className="gap-1.5">
              <Upload className="size-3.5" /> ইমপোর্ট
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setImportText(""); setShowImportPanel(false); }}>
              বাতিল
            </Button>
          </div>
        </div>
      )}

      {/* ── Label Counts Summary ───────────────────────────────────── */}
      {labelCounts && (
        <div className="flex flex-wrap gap-2 mb-4">
          {LABELS.map((l) => (
            <span
              key={l.value}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all hover:scale-105",
                l.bg
              )}
            >
              {l.value}
              <span className="opacity-70">{countFor(l.value).toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Filters & Tools Bar ────────────────────────────────────── */}
      <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <form
            className="flex-1 flex gap-2 min-w-[200px]"
            onSubmit={(e) => { e.preventDefault(); setPage(0); setTerm(search); }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                className="pl-9 bg-muted/20 border-white/5 text-sm"
                placeholder="সার্চ প্রশ্ন বা উত্তর…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="gap-1.5">
              <Filter className="size-3" /> সার্চ
            </Button>
          </form>

          {/* Status filter */}
          <Select value={status} onValueChange={(v) => { setStatus(v as Status); setPage(0); }}>
            <SelectTrigger className="w-36 bg-muted/20 border-white/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব</SelectItem>
              <SelectItem value="approved">অ্যাপ্রুভড</SelectItem>
              <SelectItem value="pending">পেন্ডিং</SelectItem>
              <SelectItem value="rejected">বাতিল</SelectItem>
            </SelectContent>
          </Select>

          {/* Import toggle */}
          <Button size="sm" variant="outline" onClick={() => setShowImportPanel(!showImportPanel)} className="gap-1.5">
            <Upload className="size-3.5" /> Import
          </Button>

          {/* Stats toggle */}
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setShowStats(!showStats)}>
            {showStats ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/20 animate-in slide-in-from-top-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {selectedIds.size} টি সিলেক্টেড
            </span>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setSelectedIds(new Set())}>
              <X className="size-3" /> Clear
            </Button>
            <Button size="sm" className="h-7 text-[10px] gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" onClick={() => bulkAction("approved")}>
              <Check className="size-3" /> Approve
            </Button>
            <Button size="sm" className="h-7 text-[10px] gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" onClick={() => bulkAction("pending")}>
              <HelpCircle className="size-3" /> Pending
            </Button>
            <Button size="sm" className="h-7 text-[10px] gap-1 bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" onClick={() => bulkAction("rejected")}>
              <XCircle className="size-3" /> Reject
            </Button>
          </div>
        )}
      </div>

      {/* ── Results Count ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString("en-US")} টি ফলাফল
          {selectedIds.size > 0 && <span className="ml-2 text-primary">({selectedIds.size} সিলেক্টেড)</span>}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px]"
          onClick={() => { qc.invalidateQueries({ queryKey: ["pairs"] }); toast.success("রিফ্রেশ করা হয়েছে"); }}
        >
          <RefreshCw className="size-3 mr-1" /> রিফ্রেশ
        </Button>
      </div>

      {/* ── Pairs List ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
        {data?.rows.map((row: any) => (
          <div
            key={row.id}
            className={cn(
              "panel p-5 bg-card/40 backdrop-blur-sm border-white/5 transition-all duration-200 hover:border-primary/20",
              selectedIds.has(row.id) && "ring-2 ring-primary/40 border-primary/30"
            )}
          >
            {editing?.id === row.id ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Question</Label>
                  <Input
                    value={editing.question}
                    onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                    className="bg-muted/20"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Answer</Label>
                  <Textarea
                    rows={3}
                    value={editing.answer}
                    onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                    className="bg-muted/20"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMutation.mutate(editing)} className="gap-1.5">
                    <Check className="size-3.5" /> সেভ
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="gap-1.5">
                    <X className="size-3.5" /> বাতিল
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  {/* Select checkbox */}
                  <button
                    onClick={() => toggleSelect(row.id)}
                    className={cn(
                      "size-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                      selectedIds.has(row.id)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border/50 hover:border-primary/50"
                    )}
                  >
                    {selectedIds.has(row.id) && <Check className="size-3" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{row.question}</p>
                      <Badge
                        variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}
                        className="shrink-0 text-[10px] uppercase tracking-wider font-black"
                      >
                        {row.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{row.answer}</p>

                    {/* Source badge */}
                    {row.source && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground border border-border/20">
                        <Terminal className="size-2.5" /> {row.source}
                      </span>
                    )}

                    {/* Label pills */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {LABELS.map((l) => {
                        const active = (row.labels ?? []).includes(l.value);
                        return (
                          <button
                            key={l.value}
                            onClick={() => toggleLabel(row.id, row.labels ?? [], l.value)}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all",
                              active
                                ? l.bg
                                : "bg-transparent text-muted-foreground/50 border-border/20 hover:border-border/50"
                            )}
                          >
                            {l.value}
                          </button>
                        );
                      })}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                        onClick={() => setEditing({ id: row.id, question: row.question, answer: row.answer })}>
                        <Pencil className="size-3 mr-1" /> এডিট
                      </Button>
                      {row.status !== "approved" && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] text-emerald-400"
                          onClick={() => statusMutation.mutate({ ids: [row.id], status: "approved" })}>
                          <Check className="size-3 mr-1" /> অ্যাপ্রুভ
                        </Button>
                      )}
                      {row.status !== "rejected" && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] text-red-400"
                          onClick={() => statusMutation.mutate({ ids: [row.id], status: "rejected" })}>
                          <X className="size-3 mr-1" /> বাতিল
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive"
                        onClick={() => setDeletingId(row.id)}>
                        <Trash2 className="size-3 mr-1" /> ডিলিট
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="gap-1.5"
        >
          <ChevronUp className="size-3 rotate-90" /> আগের
        </Button>
        <div className="flex items-center gap-2">
          {Array.from({ length: Math.min(7, maxPage + 1) }, (_, i) => {
            // Show limited page numbers
            const start = Math.max(0, Math.min(page - 3, maxPage - 6));
            const p = start + i;
            if (p > maxPage) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "size-8 rounded-lg text-xs font-bold transition-all",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
                )}
              >
                {p + 1}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= maxPage}
          onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
          className="gap-1.5"
        >
          পরের <ChevronDown className="size-3 rotate-90" />
        </Button>
      </div>

      <div className="text-center mt-2">
        <span className="text-[10px] text-muted-foreground">
          পৃষ্ঠা {page + 1} / {maxPage + 1} ({total.toLocaleString()} টি মোট)
        </span>
      </div>

      <ConfirmModal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        isLoading={deleteMutation.isPending}
        title="ডেটা মুছে ফেলুন"
        description="আপনি কি নিশ্চিত যে আপনি এই ট্রেনিং জোড়াটি মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা সম্ভব হবে না।"
      />
    </div>
  );
}