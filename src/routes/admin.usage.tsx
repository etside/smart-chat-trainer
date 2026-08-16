import { Button } from "@/components/ui/button";
import { getUsageStats } from "@/lib/usage.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { 
  BarChart3, 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  History,
  Activity,
  Zap
} from "lucide-react";

export const Route = createFileRoute("/admin/usage")({
  component: UsageDashboardPage,
});

function UsageDashboardPage() {
  const fetchUsage = useServerFn(getUsageStats);

  const { data, isLoading } = useQuery({
    queryKey: ["usage-stats"],
    queryFn: () => fetchUsage(),
    refetchInterval: 30000,
  });

  const stats = data?.stats || { total_credits: 0, total_usd: 0, total_bdt: 0 };
  const logs = data?.logs || [];
  const config = data?.config || {};

  return (
    <div className="mx-auto max-w-6xl animate-fade">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="size-8 text-primary" /> ইউজড ড্যাশবোর্ড (Usage Dashboard)
          </h1>
          <p className="mt-2 text-muted-foreground">
            AI টোকেন ব্যবহার, খরচ এবং ক্রেডিট ট্র্যাকিং রিপোর্ট।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="panel p-6 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">মোট ক্রেডিট ব্যবহার</p>
              <h3 className="text-3xl font-bold">{stats.total_credits.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="panel p-6 bg-accent/5 border-accent/20">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-accent/10 flex items-center justify-center">
              <DollarSign className="size-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">মোট খরচ (USD)</p>
              <h3 className="text-3xl font-bold">${stats.total_usd.toFixed(4)}</h3>
            </div>
          </div>
        </div>

        <div className="panel p-6 bg-green-500/5 border-green-500/20">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="size-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">মোট খরচ (BDT)</p>
              <h3 className="text-3xl font-bold">৳{stats.total_bdt.toFixed(2)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
              <History className="size-5 text-primary" />
              <h2 className="font-bold">সাম্প্রতিক ট্রানজ্যাকশন (Recent Activity)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 font-medium">সময়</th>
                    <th className="px-4 py-3 font-medium">অ্যাকশন</th>
                    <th className="px-4 py-3 font-medium">ক্রেডিট</th>
                    <th className="px-4 py-3 font-medium">খরচ (USD)</th>
                    <th className="px-4 py-3 font-medium">খরচ (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">লোড হচ্ছে...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">কোন ডেটা পাওয়া যায়নি।</td>
                    </tr>
                  ) : (
                    logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("bn-BD")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-xs bg-muted px-2 py-0.5 rounded border">
                            {log.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-primary">-{log.credits_used}</td>
                        <td className="px-4 py-3 font-mono text-xs">${log.cost_usd.toFixed(4)}</td>
                        <td className="px-4 py-3 font-mono text-xs">৳{log.cost_bdt.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6 bg-card">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="size-5 text-primary" />
              <h2 className="font-bold">রেট চার্ট (Cost Configuration)</h2>
            </div>
            <div className="space-y-4">
              {Object.entries(config).map(([key, value]: [string, any]) => (
                <div key={key} className="p-4 rounded-lg bg-muted/30 border border-white/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    {key.replace('_', ' ')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">ক্রেডিট:</span>
                      <span className="font-bold text-primary">{value.credits}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">USD:</span>
                      <span className="font-mono text-xs">${value.usd.toFixed(4)}</span>
                    </div>
                    <div className="flex flex-col col-span-2 mt-1">
                      <span className="text-xs text-muted-foreground">BDT (৳):</span>
                      <span className="font-mono text-xs">৳{value.bdt.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Zap className="size-4 text-primary" /> কুইক টিপস
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              সিস্টেম প্রতি মেসাজ, লিড স্কোরিং এবং প্রোডাক্ট সিঙ্ক করার সময় অটোমেটিক ক্রেডিট এবং খরচ হিসাব করে। 
              এটি আপনার AI টোকেন ব্যবহারের দক্ষতা বৃদ্ধি করতে সাহায্য করে।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
