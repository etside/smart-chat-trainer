import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWebhookLogs, retryWebhook, getIngestionStats } from "@/lib/console.functions";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Loader2, 
  RotateCcw, 
  History,
  ShieldAlert,
  Terminal,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/webhook-dlq")({
  component: WebhookDLQPage,
});

function WebhookDLQPage() {
  const qc = useQueryClient();
  const fetchLogs = useServerFn(getWebhookLogs);
  const triggerRetry = useServerFn(retryWebhook);
  const fetchStats = useServerFn(getIngestionStats);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "success" | "failed" | "dead_letter">("all");
  const [page, setPage] = useState(0);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ["webhook-logs", statusFilter, page],
    queryFn: () => fetchLogs({ data: { status: statusFilter, page } }),
  });

  const { data: stats } = useQuery({
    queryKey: ["ingestion-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 10000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => triggerRetry({ data: { id } }),
    onSuccess: () => {
      toast.success("রিট্রাই শুরু হয়েছে");
      qc.invalidateQueries({ queryKey: ["webhook-logs"] });
      qc.invalidateQueries({ queryKey: ["ingestion-stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deliveryCounts = stats?.deliveryCounts || { total: 0, success: 0, dead_letter: 0, pending: 0 };

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldAlert className="size-8 text-primary" /> Webhook & DLQ ম্যানেজমেন্ট
          </h1>
          <p className="mt-2 text-muted-foreground">
            ইনকামিং ওয়েব হুক ডেলিভারি, রিট্রাই হিস্টোরি এবং ইনজেশন স্ট্যাটাস মনিটর করুন।
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="panel p-5 border-white/5 bg-card/40 backdrop-blur-md">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Activity className="size-3" /> মোট ডেলিভারি
          </p>
          <p className="text-3xl font-display font-bold mt-2">{deliveryCounts.total}</p>
        </div>
        <div className="panel p-5 border-success/20 bg-success/5 backdrop-blur-md">
          <p className="text-[10px] font-bold text-success uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="size-3" /> সফল
          </p>
          <p className="text-3xl font-display font-bold mt-2">{deliveryCounts.success}</p>
        </div>
        <div className="panel p-5 border-destructive/20 bg-destructive/5 backdrop-blur-md">
          <p className="text-[10px] font-bold text-destructive uppercase tracking-widest flex items-center gap-2">
            <AlertCircle className="size-3" /> ব্যর্থ (Dead Letter)
          </p>
          <p className="text-3xl font-display font-bold mt-2">{deliveryCounts.dead_letter}</p>
        </div>
        <div className="panel p-5 border-warning/20 bg-warning/5 backdrop-blur-md">
          <p className="text-[10px] font-bold text-warning uppercase tracking-widest flex items-center gap-2">
            <Clock className="size-3" /> পেন্ডিং রিট্রাই
          </p>
          <p className="text-3xl font-display font-bold mt-2">{deliveryCounts.pending}</p>
        </div>
      </div>

      {/* Last Sync Info */}
      {stats?.lastSync && (
        <div className="panel p-4 border-primary/20 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
              <History className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary/70">সর্বশেষ সিঙ্ক রান</p>
              <p className="text-sm font-medium">{new Date(stats.lastSync.started_at).toLocaleString('bn-BD')}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={stats.lastSync.status === 'completed' ? 'default' : 'destructive'}>
              {stats.lastSync.status.toUpperCase()}
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1">{stats.lastSync.items_count || 0} আইটেম সিঙ্ক হয়েছে</p>
          </div>
        </div>
      )}

      {/* Webhook Logs Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Terminal className="size-5" /> ডেলিভারি লগসমূহ
          </h2>
          <div className="flex gap-2">
            {["all", "success", "failed", "dead_letter", "pending"].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter(s as any); setPage(0); }}
                className="text-[10px] uppercase font-bold"
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-20">
              <Loader2 className="size-10 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 font-medium">আইডি / সময়</th>
                    <th className="px-4 py-3 font-medium">সোর্স / ইভেন্ট</th>
                    <th className="px-4 py-3 font-medium">স্ট্যাটাস</th>
                    <th className="px-4 py-3 font-medium">রিট্রাই</th>
                    <th className="px-4 py-3 font-medium">ত্রুটি / বিস্তারিত</th>
                    <th className="px-4 py-3 font-medium text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logsData?.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        কোন লগ পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    logsData?.rows.map((log: any) => (
                      <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-mono text-[10px]">{log.id.slice(0, 8)}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(log.created_at).toLocaleString('bn-BD')}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-xs uppercase">{log.source}</p>
                          <p className="text-[10px] text-muted-foreground">{log.event_type}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[9px] uppercase font-black",
                              log.processing_status === 'success' ? "border-success text-success" :
                              log.processing_status === 'failed' ? "border-warning text-warning" :
                              log.processing_status === 'dead_letter' ? "border-destructive text-destructive" :
                              "border-primary text-primary"
                            )}
                          >
                            {log.processing_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold">{log.retry_count || 0}</span>
                            {log.next_retry_at && (
                              <span className="text-[9px] text-muted-foreground" title="Next retry">
                                Next: {new Date(log.next_retry_at).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 max-w-xs">
                          <p className="text-[10px] text-muted-foreground truncate" title={log.error_details || 'Success'}>
                            {log.error_details || <span className="text-success">—</span>}
                          </p>
                          {log.payload?.idempotency_key && (
                            <p className="text-[9px] font-mono text-primary/60 mt-0.5">IDEM: {log.payload.idempotency_key.slice(0, 12)}...</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={retryMutation.isPending || log.processing_status === 'success'}
                            onClick={() => retryMutation.mutate(log.id)}
                            className="h-8 w-8 p-0"
                          >
                            <RotateCcw className={cn("size-3.5", retryMutation.isPending && "animate-spin")} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {logsData && logsData.total > 20 && (
          <div className="flex items-center justify-between py-4">
            <p className="text-xs text-muted-foreground">
              মোট {logsData.total} টি ডেলিভারি পাওয়া গেছে
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="size-4 mr-1" /> পূর্ববর্তী
              </Button>
              <span className="text-xs font-bold bg-primary/10 px-3 py-1 rounded-full">
                {page + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * 20 >= logsData.total}
              >
                পরবর্তী <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Retry History List */}
      <div className="panel p-6 border-white/5 bg-card/20 backdrop-blur-sm">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
          <History className="size-5 text-primary" /> সাম্প্রতিক রিট্রাই হিস্টোরি (Active Retries)
        </h3>
        <div className="grid gap-3">
          {stats?.retryHistory.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">কোন সচল রিট্রাই নেই।</p>
          ) : (
            stats?.retryHistory.map((retry: any) => (
              <div key={retry.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-warning/20 flex items-center justify-center">
                    <RotateCcw className="size-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs font-bold font-mono">ID: {retry.id.slice(0, 8)}</p>
                    <p className="text-[10px] text-muted-foreground">Retry Count: {retry.retry_count}</p>
                  </div>
                </div>
                <Badge variant={retry.processing_status === 'dead_letter' ? 'destructive' : 'outline'}>
                  {retry.processing_status.toUpperCase()}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
