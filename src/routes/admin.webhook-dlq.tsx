import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole } from "@/lib/admin.server";
import { processWebhookRetry } from "./api.public.webhook";

export const getDlqLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, 'viewer');
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("webhook_logs")
      .select("*")
      .in("processing_status", ["dead_letter", "failed"])
      .order("created_at", { ascending: false })
      .limit(50);
    return { logs: data || [] };
  });

export const retryWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id: string })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, 'editor');
    // We update to 'pending' and set next_retry_at to now, then trigger manually
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("webhook_logs")
      .update({ processing_status: 'pending', next_retry_at: new Date().toISOString() })
      .eq("id", data.id);
    
    await processWebhookRetry(data.id);
    return { success: true };
  });

export const Route = createFileRoute("/admin/webhook-dlq")({
  component: WebhookDlq,
});

function WebhookDlq() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["webhook-dlq"],
    queryFn: () => getDlqLogs(),
  });

  const runRetry = async (id: string) => {
    try {
      await retryWebhook({ data: { id } });
      toast.success("রিট্রাই সম্পন্ন হয়েছে");
      refetch();
    } catch {
      toast.error("রিট্রাই ব্যর্থ হয়েছে");
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "dead_letter":
        return <Badge variant="destructive" className="bg-red-900/50"><AlertCircle className="size-3 mr-1"/> Dead Letter</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-orange-500 border-orange-500/50"><XCircle className="size-3 mr-1"/> Failed</Badge>;
      case "success":
        return <Badge variant="outline" className="text-green-500 border-green-500/50"><CheckCircle2 className="size-3 mr-1"/> Success</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dead-Letter Queue (DLQ)</h1>
          <p className="text-sm text-muted-foreground">ব্যর্থ হওয়া ওয়েবহুক রিকোয়েস্টগুলো এখানে জমা হয়।</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> রিফ্রেশ
        </Button>
      </div>

      <div className="panel border-t-2 border-t-destructive/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>সময়</TableHead>
              <TableHead>সোর্স/ইভেন্ট</TableHead>
              <TableHead>স্ট্যাটাস</TableHead>
              <TableHead>রিট্রাই</TableHead>
              <TableHead>এরর ডিটেইলস</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                  কোনো ব্যর্থ রিকোয়েস্ট পাওয়া যায়নি।
                </TableCell>
              </TableRow>
            )}
            {data?.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs font-mono">
                  {format(new Date(log.created_at!), "MMM d, HH:mm:ss")}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{log.source}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{log.event_type}</div>
                </TableCell>
                <TableCell>{statusBadge(log.processing_status || 'failed')}</TableCell>
                <TableCell className="text-xs font-mono">{log.retry_count || 0}/5</TableCell>
                <TableCell className="max-w-xs truncate text-[10px] text-destructive italic" title={log.error_details || ''}>
                  {log.error_details || "No details available"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => runRetry(log.id)}>
                    <RefreshCw className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}