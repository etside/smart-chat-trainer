import { getTrainingJobs, triggerTraining } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Clock, Loader2, Play, RotateCcw, ExternalLink, Database, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getTrainingJobDetail } from "@/lib/console.functions";
import { useState } from "react";


import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/progress")({
  component: TrainingProgress,
});


function TrainingProgress() {
  const qc = useQueryClient();
  const fetchJobs = useServerFn(getTrainingJobs);
  const startTraining = useServerFn(triggerTraining);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: () => fetchJobs(),
    refetchInterval: 5000,
  });

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

          disabled={mutation.isPending || jobs?.some((j: any) => j.status === 'processing')}
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
            <AnimatePresence mode="popLayout">
              {jobs?.map((job: any, index: number) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
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
                          onClick={() => mutation.mutate(undefined)}
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
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>

  );
}
