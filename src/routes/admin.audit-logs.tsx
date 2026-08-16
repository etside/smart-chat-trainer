import { Button } from "@/components/ui/button";
import { getAuditLogs } from "@/lib/audit.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { History, Search, User, Activity, Shield } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/audit-logs")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const fetchAudit = useServerFn(getAuditLogs);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => fetchAudit({ data: { page } }),
  });

  return (
    <div className="mx-auto max-w-6xl animate-fade">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="size-8 text-primary" /> অ্যাডমিন অডিট লগ (Audit Log)
          </h1>
          <p className="mt-2 text-muted-foreground">
            সিস্টেমের গুরুত্বপূর্ণ পরিবর্তন এবং অ্যাকশনগুলোর ট্র্যাকিং হিস্টোরি।
          </p>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 font-medium">সময় (Timestamp)</th>
              <th className="px-4 py-3 font-medium">অ্যাকশন (Action)</th>
              <th className="px-4 py-3 font-medium">অ্যাক্টর (Actor)</th>
              <th className="px-4 py-3 font-medium">বিস্তারিত (Metadata)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">লোড হচ্ছে...</td>
              </tr>
            ) : data?.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">কোন লগ পাওয়া যায়নি।</td>
              </tr>
            ) : (
              data?.rows.map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("bn-BD")}
                  </td>
                  <td className="px-4 py-4">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <User className="size-3 text-muted-foreground" />
                      <span className="text-xs truncate max-w-[150px]" title={log.actor_id}>
                        {log.actor_id?.slice(0, 8)}...
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <pre className="text-[10px] bg-background p-2 rounded border border-border/50 max-h-24 overflow-y-auto custom-scrollbar font-mono">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.total > data.size && (
          <div className="flex items-center justify-between p-4 bg-muted/20 border-t">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              পূর্ববর্তী
            </Button>
            <span className="text-xs text-muted-foreground">পেজ {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * data.size >= data.total}
              onClick={() => setPage(p => p + 1)}
            >
              পরবর্তী
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
