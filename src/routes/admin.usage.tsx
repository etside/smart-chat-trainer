import { Button } from "@/components/ui/button";
import { 
  getUsageStats, 
  getUsageAlerts, 
  saveUsageAlert, 
  deleteUsageAlert,
  getNotifications
} from "@/lib/usage.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  History,
  Activity,
  Zap,
  Bell,
  Settings2,
  Plus,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/usage")({
  component: UsageDashboardPage,
});

function UsageDashboardPage() {
  const queryClient = useQueryClient();
  const fetchUsage = useServerFn(getUsageStats);
  const fetchAlerts = useServerFn(getUsageAlerts);
  const fetchNotifications = useServerFn(getNotifications);
  const saveAlertFn = useServerFn(saveUsageAlert);
  const deleteAlertFn = useServerFn(deleteUsageAlert);

  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({
    type: 'daily' as 'daily' | 'monthly',
    threshold_credits: 1000,
    threshold_usd: 1.0,
    threshold_bdt: 120.0
  });

  const { data, isLoading } = useQuery({
    queryKey: ["usage-stats"],
    queryFn: () => fetchUsage(),
    refetchInterval: 30000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["usage-alerts"],
    queryFn: () => fetchAlerts(),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["usage-notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 10000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => saveAlertFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usage-alerts"] });
      setIsAddingAlert(false);
      toast.success("অ্যালার্ট সেভ করা হয়েছে");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlertFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usage-alerts"] });
      toast.success("অ্যালার্ট ডিলিট করা হয়েছে");
    }
  });

  const stats = data?.stats || { total_credits: 0, total_usd: 0, total_bdt: 0 };
  const logs = data?.logs || [];
  const config = data?.config || {};

  return (
    <div className="mx-auto max-w-7xl animate-fade space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="size-8 text-primary" /> ইউজড ড্যাশবোর্ড
          </h1>
          <p className="mt-2 text-muted-foreground">
            AI টোকেন ব্যবহার, খরচ এবং অ্যালার্ট সিস্টেম।
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
            <Activity className="mr-2 size-4" /> রিফ্রেশ
          </Button>
        </div>
      </div>

      {/* Main Stats - 3 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="panel p-8 bg-primary/5 border-primary/20 relative overflow-hidden group shadow-2xl shadow-primary/5">
          <Zap className="absolute -right-4 -bottom-4 size-32 text-primary/10 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-70">মোট ক্রেডিট (Total Credits)</p>
            <h3 className="text-5xl font-black tracking-tighter tabular-nums">{stats.total_credits.toLocaleString()}</h3>
            <div className="mt-6 flex items-center text-[10px] text-primary font-black tracking-widest uppercase bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
              <TrendingUp className="mr-1.5 size-3" /> Lifetime Usage
            </div>
          </div>
        </div>

        <div className="panel p-8 bg-accent/5 border-accent/20 relative overflow-hidden group shadow-2xl shadow-accent/5">
          <DollarSign className="absolute -right-4 -bottom-4 size-32 text-accent/10 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-70">মোট খরচ (USD Cost)</p>
            <h3 className="text-5xl font-black tracking-tighter tabular-nums">${stats.total_usd.toFixed(4)}</h3>
            <div className="mt-6 flex items-center text-[10px] text-accent font-black tracking-widest uppercase bg-accent/10 w-fit px-3 py-1 rounded-full border border-accent/20">
              <Activity className="mr-1.5 size-3" /> Estimated Burn
            </div>
          </div>
        </div>

        <div className="panel p-8 bg-success/5 border-success/20 relative overflow-hidden group shadow-2xl shadow-success/5 md:col-span-2 lg:col-span-1">
          <TrendingUp className="absolute -right-4 -bottom-4 size-32 text-success/10 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-70">মোট খরচ (BDT Equivalent)</p>
            <h3 className="text-5xl font-black tracking-tighter tabular-nums">৳{stats.total_bdt.toFixed(2)}</h3>
            <div className="mt-6 flex items-center text-[10px] text-success font-black tracking-widest uppercase bg-success/10 w-fit px-3 py-1 rounded-full border border-success/20">
              <Zap className="mr-1.5 size-3" /> Converted Local
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Logs & Alerts - Left 8 Columns */}
        <div className="lg:col-span-8 space-y-8">
          {/* Notifications / Alerts Section */}
          {notifications.length > 0 && (
            <div className="panel border-destructive/30 bg-destructive/5">
              <div className="p-4 border-b border-destructive/20 flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive animate-pulse" />
                <h2 className="font-bold text-destructive">সিস্টেম নোটিফিকেশন (System Alerts)</h2>
              </div>
              <div className="p-4 space-y-3">
                {notifications.map((n: any) => (
                  <div key={n.id} className={cn("p-3 rounded-lg border text-sm", n.read ? "bg-muted/50" : "bg-destructive/10 border-destructive/20")}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold">{n.title}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("bn-BD")}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-5 text-primary" />
                <h2 className="font-bold">সাম্প্রতিক ট্রানজ্যাকশন</h2>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Last 50 Actions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">সময়</th>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">অ্যাকশন</th>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">ক্রেডিট</th>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">খরচ (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">লোড হচ্ছে...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">কোন ডেটা পাওয়া যায়নি।</td>
                    </tr>
                  ) : (
                    logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-6 py-4 text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("bn-BD")}
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize text-[10px] font-black tracking-tighter bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                            {log.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-primary tabular-nums">-{log.credits_used}</td>
                        <td className="px-6 py-4 font-mono text-xs tabular-nums font-bold">৳{log.cost_bdt.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Alerts Config & Rate Chart - Right 4 Columns */}
        <div className="lg:col-span-4 space-y-6">
          <div className="panel p-6 bg-card border-primary/10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-primary" />
                <h2 className="font-bold">ইউসেজ অ্যালার্ট</h2>
              </div>
              <Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={() => setIsAddingAlert(!isAddingAlert)}>
                <Plus className="size-4" />
              </Button>
            </div>

            {isAddingAlert && (
              <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">টাইপ</label>
                    <select 
                      className="w-full bg-background border rounded px-2 py-1.5 text-xs"
                      value={newAlert.type}
                      onChange={e => setNewAlert({...newAlert, type: e.target.value as any})}
                    >
                      <option value="daily">ডেইলি</option>
                      <option value="monthly">মান্থলি</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">ক্রেডিট</label>
                    <input 
                      type="number" 
                      className="w-full bg-background border rounded px-2 py-1.5 text-xs"
                      value={newAlert.threshold_credits}
                      onChange={e => setNewAlert({...newAlert, threshold_credits: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">লিমিট (BDT)</label>
                  <input 
                    type="number" 
                    className="w-full bg-background border rounded px-2 py-1.5 text-xs font-bold"
                    value={newAlert.threshold_bdt}
                    onChange={e => setNewAlert({...newAlert, threshold_bdt: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="w-full text-xs font-bold" onClick={() => saveMutation.mutate(newAlert)}>সেভ করুন</Button>
                  <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => setIsAddingAlert(false)}>বাতিল</Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">কোন অ্যালার্ট সেট করা নেই।</p>
              ) : (
                alerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20 group">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", alert.type === 'daily' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500")}>
                          {alert.type === 'daily' ? 'DAILY' : 'MONTHLY'}
                        </span>
                        <span className="text-xs font-bold">৳{alert.threshold_bdt}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{alert.threshold_credits} Credits Threshold</p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="size-7 opacity-0 group-hover:opacity-100 text-destructive transition-all"
                      onClick={() => deleteMutation.mutate(alert.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel p-6 bg-card border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Settings2 className="size-5 text-primary" />
              <h2 className="font-bold uppercase text-xs tracking-widest">রেট কনফিগারেশন</h2>
            </div>
            <div className="space-y-4">
              {Object.entries(config).map(([key, value]: [string, any]) => (
                <div key={key} className="p-4 rounded-xl bg-muted/30 border border-white/5 relative overflow-hidden group">
                   <div className="absolute right-0 top-0 size-12 bg-primary/5 rounded-bl-3xl -mr-4 -mt-4 group-hover:bg-primary/10 transition-colors" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
                    {key.replace('_', ' ')}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm relative z-10">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">ক্রেডিট</span>
                      <span className="font-black text-primary tabular-nums">{value.credits}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">BDT (৳)</span>
                      <span className="font-mono text-xs font-bold tabular-nums">৳{value.bdt.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
              <Zap className="size-4 text-primary" /> স্মার্ট টিপস
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              সিস্টেম অটোমেটিক ভাবে ইউসেজ অ্যালার্ট চেক করে এবং আপনার বাজেট অতিক্রম করলে নোটিফিকেশন পাঠায়। ডেইলি এবং মান্থলি লিমিট সেট করে আপনার AI খরচ নিয়ন্ত্রণ করুন।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
