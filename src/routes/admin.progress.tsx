import { getTrainingJobs, triggerTraining } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Clock, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
    mutationFn: () => startTraining({ data: {} }),
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
          <h1 className="text-2xl font-semibold">ট্রেনিং প্রগ্রেস</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            অটোমেটিক ট্রেনিং জব এবং ডেটা প্রসেসিং স্ট্যাটাস।
          </p>
        </div>
        <Button 
          onClick={() => mutation.mutate()} 
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
          <div className="panel overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">জব আইডি</th>
                  <th className="px-4 py-3 font-medium">স্ট্যাটাস</th>
                  <th className="px-4 py-3 font-medium">আইটেম সংখ্যা</th>
                  <th className="px-4 py-3 font-medium">সময়</th>
                  <th className="px-4 py-3 font-medium">এরর</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs?.map((job: any) => (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 font-mono text-xs">{job.id.slice(0, 8)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {job.status === "completed" && (
                          <CheckCircle2 className="size-4 text-green-500" />
                        )}
                        {job.status === "failed" && (
                          <AlertCircle className="size-4 text-destructive" />
                        )}
                        {job.status === "processing" && (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        )}
                        {job.status === "pending" && (
                          <Clock className="size-4 text-muted-foreground" />
                        )}
                        <span className="capitalize">{job.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">{job.processed_count || 0}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {new Date(job.created_at).toLocaleString("bn-BD")}
                    </td>
                    <td className="px-4 py-4 max-w-xs truncate text-destructive">
                      {job.error_message || "—"}
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
