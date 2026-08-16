import { Button } from "@/components/ui/button";
import { getSyncRuns, previewSync, syncCatalog } from "@/lib/sync.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Loader2, 
  Play, 
  Search, 
  Download,
  Database
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sync")({
  component: SyncStatusPage,
});

function SyncStatusPage() {
  const qc = useQueryClient();
  const fetchRuns = useServerFn(getSyncRuns);
  const triggerSync = useServerFn(syncCatalog);
  const getPreview = useServerFn(previewSync);

  const [previewData, setPreviewData] = useState<any[] | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["sync-runs"],
    queryFn: () => fetchRuns(),
    refetchInterval: 10000,
  });

  const syncMutation = useMutation({
    mutationFn: () => triggerSync({ data: {} }),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["sync-runs"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const previewMutation = useMutation({
    mutationFn: () => getPreview({ data: {} }),
    onSuccess: (res) => {
      setPreviewData(res.preview);
      toast.success("প্রিভিউ লোড হয়েছে");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleExport = (data: any[], filename: string) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", filename);
    link.click();
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="size-6 text-primary" /> প্রোডাক্ট সিঙ্ক স্ট্যাটাস
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            প্রোডাক্ট, স্টক এবং ইনভেন্টরি সিঙ্ক্রোনাইজেশন মনিটর করুন।
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            ম্যাপিং প্রিভিউ
          </Button>
          <Button 
            onClick={() => syncMutation.mutate()} 
            disabled={syncMutation.isPending || runs?.some((r: any) => r.status === 'processing')}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            এখনই সিঙ্ক করুন
          </Button>
        </div>
      </div>

      {previewData && (
        <div className="mt-8 panel p-5 border-primary/20 bg-primary/5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Database className="size-4" /> প্রোডাক্ট ম্যাপিং প্রিভিউ (Validation)
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)}>বন্ধ করুন</Button>
          </div>
          <div className="grid gap-3">
            {previewData.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-background rounded-lg border text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">Price: {item.price} | Stock: {item.stock}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.isValid ? (
                    <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full border border-green-200">VALID</span>
                  ) : (
                    <span className="text-[10px] bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full border border-red-200">INVALID</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground italic">
            * প্রিভিউতে শুধু প্রথম ৫টি আইটেম দেখানো হচ্ছে। 'INVALID' আইটেমগুলো সিঙ্কের সময় বাদ দেওয়া হবে।
          </p>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">সাম্প্রতিক সিঙ্ক রানসমূহ</h2>
          {runs && runs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => handleExport(runs, "sync_history.json")}>
              <Download className="mr-2 h-4 w-4" /> এক্সপোর্ট লগ
            </Button>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : runs?.length === 0 ? (
          <div className="panel p-12 text-center">
            <p className="text-muted-foreground">কোন সিঙ্ক রেকর্ড পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">আইডি</th>
                  <th className="px-4 py-3 font-medium">স্ট্যাটাস</th>
                  <th className="px-4 py-3 font-medium">আইটেম সংখ্যা</th>
                  <th className="px-4 py-3 font-medium">শুরু</th>
                  <th className="px-4 py-3 font-medium">এরর মেসেজ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs?.map((run: any) => (
                  <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 font-mono text-xs">{run.id.slice(0, 8)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {run.status === "completed" && (
                          <CheckCircle2 className="size-4 text-green-500" />
                        )}
                        {run.status === "failed" && (
                          <AlertCircle className="size-4 text-destructive" />
                        )}
                        {run.status === "processing" && (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        )}
                        <span className="capitalize">{run.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold">{run.items_count || 0}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {new Date(run.started_at).toLocaleString("bn-BD")}
                    </td>
                    <td className="px-4 py-4 max-w-xs truncate text-destructive text-xs">
                      {run.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
