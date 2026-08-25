import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, CheckCircle, User, MessageSquare } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.server";

const getEscalations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("escalation_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

const resolveEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }: { context: any; data: { id: string; notes?: string } }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("escalation_queue")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        notes: data.notes,
      })
      .eq("id", data.id);
    return { ok: true };
  });

const assignEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }: { context: any; data: { id: string; assignedTo: string } }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("escalation_queue")
      .update({
        status: "assigned",
        assigned_to: data.assignedTo,
      })
      .eq("id", data.id);
    return { ok: true };
  });

const getLeadScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("lead_scores")
      .select("*")
      .order("score", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const Route = createFileRoute("/admin/escalation")({
  component: EscalationPage,
});

function priorityColor(p: string) {
  if (p === "urgent") return "bg-red-600 text-white";
  if (p === "high") return "bg-orange-500 text-white";
  if (p === "medium") return "bg-yellow-500 text-black";
  return "bg-blue-500 text-white";
}

function statusIcon(s: string) {
  if (s === "resolved") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (s === "in_progress") return <Clock className="h-4 w-4 text-yellow-500" />;
  return <AlertTriangle className="h-4 w-4 text-orange-500" />;
}

function tierColor(t: string) {
  if (t === "qualified") return "bg-green-600 text-white";
  if (t === "hot") return "bg-red-500 text-white";
  if (t === "warm") return "bg-orange-400 text-white";
  return "bg-slate-400 text-white";
}

function EscalationPage() {
  const queryClient = useQueryClient();

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["escalations"],
    queryFn: () => getEscalations(),
  });

  const { data: leadScores = [] } = useQuery({
    queryKey: ["lead-scores"],
    queryFn: () => getLeadScores(),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveEscalation({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["escalations"] }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      assignEscalation({ data: { id, assignedTo: name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["escalations"] }),
  });

  const pending = escalations.filter((e: any) => e.status === "pending");
  const active = escalations.filter((e: any) => e.status === "assigned" || e.status === "in_progress");
  const resolved = escalations.filter((e: any) => e.status === "resolved");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Escalation Queue & Lead Scores</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-500">{pending.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-yellow-500">{active.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resolved</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-500">{resolved.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Hot Leads</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {leadScores.filter((l: any) => l.tier === "hot" || l.tier === "qualified").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="escalations">
        <TabsList>
          <TabsTrigger value="escalations">Escalation Queue</TabsTrigger>
          <TabsTrigger value="leads">Lead Scores</TabsTrigger>
        </TabsList>

        <TabsContent value="escalations">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Lead Score</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>
                  ) : escalations.length === 0 ? (
                    <TableRow><TableCell colSpan={8}>No escalations yet</TableCell></TableRow>
                  ) : (
                    escalations.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{statusIcon(e.status)} <span className="ml-1 text-xs">{e.status}</span></TableCell>
                        <TableCell><Badge className={priorityColor(e.priority)}>{e.priority}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{e.reason}</TableCell>
                        <TableCell>{e.channel}</TableCell>
                        <TableCell className="font-mono">{e.lead_score}</TableCell>
                        <TableCell className="text-xs">{e.external_id ?? "-"}</TableCell>
                        <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          {e.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => assignMutation.mutate({ id: e.id, name: "admin" })}>
                                <User className="h-3 w-3 mr-1" />Assign
                              </Button>
                              <Button size="sm" variant="default" onClick={() => resolveMutation.mutate(e.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" />Resolve
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Last Evaluated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadScores.length === 0 ? (
                    <TableRow><TableCell colSpan={5}>No lead scores yet</TableCell></TableRow>
                  ) : (
                    leadScores.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono font-bold">{l.score}</TableCell>
                        <TableCell><Badge className={tierColor(l.tier)}>{l.tier}</Badge></TableCell>
                        <TableCell className="text-xs">{l.external_id ?? "-"}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">
                          {Array.isArray(l.signals) ? l.signals.join(", ") : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{new Date(l.last_evaluated_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
