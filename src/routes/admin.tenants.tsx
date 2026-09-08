import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Users, BarChart3, Crown, Search, ChevronRight,
  MoreVertical, CheckCircle2, XCircle, Clock, Loader2, Plus,
  AlertTriangle, Trash2, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Server functions ───────────────────────────────────────────────────────

const listTenants = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tenants")
    .select(`
      id, slug, name, email, phone, status, created_at, trial_ends_at,
      plan:plans(name, price_bdt),
      tenant_users(count)
    `)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
});

const updateTenantStatus = createServerFn({ method: "POST" })
  .validator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tenants").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

const deleteTenant = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tenants").delete().eq("id", data.id);
    return { ok: true };
  });

const getTenantsStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [total, active, trial, suspended] = await Promise.all([
    supabaseAdmin.from("tenants").select("id", { count: "exact" }),
    supabaseAdmin.from("tenants").select("id", { count: "exact" }).eq("status", "active"),
    supabaseAdmin.from("tenants").select("id", { count: "exact" }).eq("status", "trial"),
    supabaseAdmin.from("tenants").select("id", { count: "exact" }).eq("status", "suspended"),
  ]);
  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    trial: trial.count ?? 0,
    suspended: suspended.count ?? 0,
  };
});

// ── Route ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/tenants")({
  component: TenantsPage,
});

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    active:    { label: "Active",    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="size-3" /> },
    trial:     { label: "Trial",     className: "bg-blue-500/10 text-blue-400 border-blue-500/20",         icon: <Clock className="size-3" /> },
    suspended: { label: "Suspended", className: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="size-3" /> },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border",             icon: <XCircle className="size-3" /> },
  };
  const s = map[status] ?? map.active;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.className}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

function TenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => listTenants(),
  });

  const { data: stats } = useQuery({
    queryKey: ["tenants-stats"],
    queryFn: () => getTenantsStats(),
  });

  const statusMut = useMutation({
    mutationFn: (d: { id: string; status: string }) => updateTenantStatus({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); qc.invalidateQueries({ queryKey: ["tenants-stats"] }); toast.success("Status updated"); },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTenant({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); qc.invalidateQueries({ queryKey: ["tenants-stats"] }); toast.success("Tenant deleted"); setConfirmDelete(null); },
    onError: () => toast.error("Failed to delete"),
  });

  const filtered = tenants.filter((t: any) =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = [
    { label: "Total tenants", value: stats?.total ?? 0, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active", value: stats?.active ?? 0, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Trial", value: stats?.trial ?? 0, icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Suspended", value: stats?.suspended ?? 0, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Crown className="size-6 text-primary" /> Tenant Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">All SaaS customers and their subscriptions</p>
        </div>
        <Button size="sm" className="rounded-full gap-1.5" onClick={() => window.open('/signup', '_blank')}>
          <Plus className="size-4" /> Add tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className={`flex size-8 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`size-4 ${s.color}`} />
              </span>
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or slug..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Loading tenants...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Building2 className="size-10 opacity-30" />
            <p className="text-sm">{search ? "No tenants match your search" : "No tenants yet"}</p>
            {!search && (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => window.open('/signup', '_blank')}>
                <Plus className="size-3.5 mr-1.5" /> Create first tenant
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Users</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t: any, i: number) => (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="capitalize text-xs font-medium bg-muted px-2 py-1 rounded-full">
                        {t.plan?.name ?? "free"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {t.tenant_users?.[0]?.count ?? 0}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setActionMenu(actionMenu === t.id ? null : t.id)}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                        {actionMenu === t.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border bg-popover shadow-xl z-20 py-1">
                            {t.status !== 'active' && (
                              <button
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-emerald-400"
                                onClick={() => { statusMut.mutate({ id: t.id, status: 'active' }); setActionMenu(null); }}
                              >
                                <CheckCircle2 className="size-3.5" /> Activate
                              </button>
                            )}
                            {t.status !== 'suspended' && (
                              <button
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-destructive"
                                onClick={() => { statusMut.mutate({ id: t.id, status: 'suspended' }); setActionMenu(null); }}
                              >
                                <XCircle className="size-3.5" /> Suspend
                              </button>
                            )}
                            <button
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-destructive"
                              onClick={() => { setConfirmDelete(t.id); setActionMenu(null); }}
                            >
                              <Trash2 className="size-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </span>
              <div>
                <h3 className="font-semibold">Delete tenant?</h3>
                <p className="text-xs text-muted-foreground">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-full"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(confirmDelete)}
              >
                {deleteMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
