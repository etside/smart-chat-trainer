import { getTrainingJobs, triggerTraining, getTrainingJobDetail, exportTrainingRunLogs, savePair, deletePair } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  Play, 
  RotateCcw, 
  ExternalLink, 
  Database, 
  MessageSquare,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/progress")({
  component: TrainingProgress,
});

function TrainingProgress() {
  const qc = useQueryClient();
  const fetchJobs = useServerFn(getTrainingJobs);
  const startTraining = useServerFn(triggerTraining);
  const fetchJobDetail = useServerFn(getTrainingJobDetail);
  const exportLogs = useServerFn(exportTrainingRunLogs);
  const doSavePair = useServerFn(savePair);
  const doDeletePair = useServerFn(deletePair);
  const [editingPair, setEditingPair] = useState<any>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const savePairMut = useMutation({
    mutationFn: (d: any) => doSavePair({ data: d }),
    onSuccess: () => { toast.success("পেয়ার সংরক্ষিত"); setEditingPair(null); qc.invalidateQueries({ queryKey: ["training-job-detail"] }); },
    onError: (e: any) => toast.error("সংরক্ষণ ব্যর্থ: " + (e.message || "unknown")),
  });
  const delPairMut = useMutation({
    mutationFn: (id: string) => doDeletePair({ data: { id } }),
    onSuccess: () => { toast.success("পেয়ার মুছে ফেলা হয়েছে"); qc.invalidateQueries({ queryKey: ["training-job-detail"] }); },
    onError: (e: any) => toast.error("মুছে ফেলা ব্যর্থ: " + (e.message || "unknown")),
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const previousJobsRef = useRef<any[]>([]);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: () => fetchJobs(),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (jobs && previousJobsRef.current.length > 0) {
      jobs.forEach((job: any) => {
        const prevJob = previousJobsRef.current.find(pj => pj.id === job.id);
        if (prevJob && prevJob.status === 'running' && job.status !== 'running') {
          if (job.status === 'completed') {
            toast.success(`জব #${job.id.slice(0, 8)} সফলভাবে শেষ হয়েছে।`, {
              description: `${job.processed_count || 0} আইটেম প্রসেস করা হয়েছে।`,
              duration: 5000,
            });
          } else if (job.status === 'failed') {
            toast.error(`জব #${job.id.slice(0, 8)} ব্যর্থ হয়েছে।`, {
              description: job.error_log || "অজানা ত্রুটি",
              duration: 8000,
            });
          }
        }
      });
    }
    if (jobs) {
      previousJobsRef.current = jobs;
    }
  }, [jobs]);

  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ["training-job-detail", selectedJobId, searchTerm, page],
    queryFn: () => selectedJobId ? fetchJobDetail({ data: { id: selectedJobId, search: searchTerm, page } }) : null,
    enabled: !!selectedJobId,
  });

  const handleExport = async (id: string, format: 'json' | 'csv') => {
    try {
      const { json } = await exportLogs({ data: { id } });
      const data = JSON.parse(json);
      
      let blob;
      let filename = `training-logs-${id.slice(0, 8)}`;

      if (format === 'csv') {
        const headers = ["Question", "Answer", "Status", "Created At"];
        const rows = data.samples.map((s: any) => [
          `"${s.question.replace(/"/g, '""')}"`,
          `"${s.answer.replace(/"/g, '""')}"`,
          s.status,
          s.created_at
        ]);
        const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        filename += ".csv";
      } else {
        blob = new Blob([json], { type: "application/json" });
        filename += ".json";
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      toast.success("Log export successful");
    } catch (err) {
      toast.error("Export failed");
    }
  };

  const mutation = useMutation({
    mutationFn: (versionId?: string) => startTraining({ data: { version_id: versionId } }),
    onSuccess: () => {
      toast.success("ট্রেনিং শুরু হয়েছে");
      qc.invalidateQueries({ queryKey: ["training-jobs"] });
    },
    onError: () => toast.error("ট্রেনিং শুরু করা যায়নি"),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ট্রেনিং লাইভ প্রগ্রেস</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            অটোমেটিক ট্রেনিং জব, রিট্রাই এবং ফেইলিয়র স্ট্যাটাস এখানে দেখা যাবে।
          </p>
        </div>
        <Button 
          onClick={() => mutation.mutate(undefined)} 
          disabled={mutation.isPending || jobs?.some((j: any) => j.status === 'running')}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          ম্যানুয়াল রিট্রেন (Manual Retrain)
        </Button>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : jobs?.length === 0 ? (
          <div className="panel p-12 text-center">
            <p className="text-muted-foreground">কোন ট্রেনিং জব পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="grid gap-6">
            <>
              {jobs?.map((job: any, index: number) => (
                <div
                  key={job.id}
                  className="panel p-6 bg-card/40 backdrop-blur-md border-white/5 shadow-xl hover:shadow-2xl transition-all"
                >
                  <div 
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "size-12 rounded-2xl flex items-center justify-center shadow-lg",
                        job.status === "completed" ? "bg-success/20 text-success shadow-success/10" :
                        job.status === "failed" ? "bg-destructive/20 text-destructive shadow-destructive/10" :
                        "bg-primary/20 text-primary shadow-primary/10"
                      )}>
                        {job.status === "completed" && <CheckCircle2 className="size-6" />}
                        {job.status === "failed" && <AlertCircle className="size-6" />}
                        {job.status === "running" && <Loader2 className="size-6 animate-spin" />}
                        {job.status === "pending" && <Clock className="size-6" />}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">জব #{job.id.slice(0, 8)}</h3>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            job.status === "completed" ? "bg-success/20 text-success" :
                            job.status === "failed" ? "bg-destructive/20 text-destructive" :
                            "bg-primary/20 text-primary"
                          )}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <Clock className="size-3" />
                          {new Date(job.created_at).toLocaleString("bn-BD")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">আইটেম</p>
                        <p className="text-xl font-display font-bold">{job.processed_count || 0}</p>
                      </div>

                      <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">রিট্রাই</p>
                        <p className="text-xl font-display font-bold text-warning">{job.retry_count || 0}</p>
                      </div>
                      
                      {job.status === "failed" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            mutation.mutate(undefined);
                          }}
                          disabled={mutation.isPending}
                          className="h-9"
                        >
                          <RotateCcw className={cn("mr-2 size-4", mutation.isPending && "animate-spin")} />
                          রিট্রাই
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {job.error_log && (
                    <div className="mt-4 p-3 rounded-lg bg-destructive/5 border border-destructive/10 text-xs text-destructive font-mono">
                      Error: {job.error_log}
                    </div>
                  )}
                </div>
              ))}
            </>
          </div>
        )}
      </div>

      <Dialog open={!!selectedJobId} onOpenChange={(open) => !open && setSelectedJobId(null)}>
        <DialogContent className="w-[94vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>জব ডিটেইলস (#{selectedJobId?.slice(0, 8)})</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport(selectedJobId!, 'json')}>
                  <Download className="mr-2 size-4" /> JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport(selectedJobId!, 'csv')}>
                  <Download className="mr-2 size-4" /> CSV
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              ট্রেনিং রান স্ট্যাটাস, স্যাম্পল এবং লগস।
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-card border border-white/5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">স্ট্যাটাস</p>
                  <Badge variant={detailData.job.status === 'completed' ? 'default' : detailData.job.status === 'failed' ? 'destructive' : 'secondary'} className="mt-1">
                    {detailData.job.status}
                  </Badge>
                </div>
                <div className="p-4 rounded-xl bg-card border border-white/5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">আইটেম</p>
                  <p className="text-xl font-bold">{detailData.job.processed_count || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-white/5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">রিট্রাই</p>
                  <p className="text-xl font-bold">{detailData.job.retry_count || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-white/5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">সময়</p>
                  <p className="text-xs mt-1">{new Date(detailData.job.created_at).toLocaleString()}</p>
                </div>
              </div>

              {detailData.job.error_log && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-bold text-destructive uppercase mb-2">Error Log</p>
                  <code className="text-xs">{detailData.job.error_log}</code>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="size-4" />
                    ট্রান্সক্রিপশন স্যাম্পল
                  </h3>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="সার্চ স্যাম্পল..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">প্রশ্ন (Question)</TableHead>
                        <TableHead className="min-w-[120px]">উত্তর (Answer)</TableHead>
                        <TableHead>স্ট্যাটাস</TableHead>
                        <TableHead className="w-20 text-right">অ্যাকশন</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailData.samples.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            কোন স্যাম্পল পাওয়া যায়নি।
                          </TableCell>
                        </TableRow>
                      ) : (
                        detailData.samples.map((sample: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{sample.question}</TableCell>
                            <TableCell className="text-xs">{sample.answer}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {sample.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingPair(sample); setEditQ(sample.question); setEditA(sample.answer); }} title="এডিট">
                                  <Pencil className="size-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => delPairMut.mutate(sample.id)} title="মুছুন">
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {detailData.totalSamples > detailData.pageSize && (
                  <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="size-4 mr-2" />
                      পূর্ববর্তী
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      পেজ {page + 1} / {Math.ceil(detailData.totalSamples / detailData.pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * detailData.pageSize >= detailData.totalSamples}
                    >
                      পরবর্তী
                      <ChevronRight className="size-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPair} onOpenChange={(o) => !o && setEditingPair(null)}>
        <DialogContent className="w-[94vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>পেয়ার এডিট করুন</DialogTitle>
            <DialogDescription>প্রশ্ন ও উত্তর পরিবর্তন করুন।</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-1">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">প্রশ্ন</label>
              <Textarea value={editQ} onChange={(e) => setEditQ(e.target.value)} rows={3} className="text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">উত্তর</label>
              <Textarea value={editA} onChange={(e) => setEditA(e.target.value)} rows={5} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPair(null)}>বাতিল</Button>
            <Button onClick={() => savePairMut.mutate({ id: editingPair?.id, question: editQ, answer: editA, status: editingPair?.status })} disabled={savePairMut.isPending || !editQ.trim() || !editA.trim()}>
              {savePairMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "সংরক্ষণ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}