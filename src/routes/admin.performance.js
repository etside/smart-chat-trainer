import { getPerformanceStats, updatePerformanceSettings } from "@/lib/performance.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Zap, Activity, Settings, BarChart, Cpu } from "lucide-react";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/performance")({
    component: PerformanceDashboard,
});
function PerformanceDashboard() {
    const queryClient = useQueryClient();
    const fetchStats = useServerFn(getPerformanceStats);
    const updateSettings = useServerFn(updatePerformanceSettings);
    const { data, isLoading } = useQuery({
        queryKey: ["performance-stats"],
        queryFn: () => fetchStats(),
        refetchInterval: 5000,
    });
    const mutation = useMutation({
        mutationFn: (vars) => updateSettings({ data: vars }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["performance-stats"] });
            toast.success("সেটিংস আপডেট হয়েছে");
        }
    });
    if (isLoading)
        return <div className="p-10">লোড হচ্ছে...</div>;
    const metrics = data?.metrics || [];
    const settings = data?.settings || { max_simultaneous_replies: 5, enable_streaming: true };
    const avgTranscription = metrics.filter((m) => m.action === 'transcription').reduce((acc, m) => acc + m.duration_ms, 0) / (metrics.filter((m) => m.action === 'transcription').length || 1);
    const avgAnalysis = metrics.filter((m) => m.action === 'analysis').reduce((acc, m) => acc + m.duration_ms, 0) / (metrics.filter((m) => m.action === 'analysis').length || 1);
    const avgReply = metrics.filter((m) => m.action === 'reply').reduce((acc, m) => acc + m.duration_ms, 0) / (metrics.filter((m) => m.action === 'reply').length || 1);
    return (<div className="mx-auto max-w-7xl space-y-8 animate-fade">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="size-8 text-yellow-500"/> পারফরম্যান্স ড্যাশবোর্ড
          </h1>
          <p className="mt-2 text-muted-foreground">এজেন্ট রেসপন্স, ট্রান্সক্রিপশন এবং এনালাইসিস লেটেন্সি ট্র্যাকিং।</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="panel p-6 bg-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-2 mb-2 text-blue-500">
            <Mic className="size-4"/> 
            <span className="text-xs font-bold uppercase">গড় ট্রান্সক্রিপশন সময়</span>
          </div>
          <h3 className="text-4xl font-black">{Math.round(avgTranscription)}ms</h3>
          <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">Voice to Text Latency</p>
        </div>

        <div className="panel p-6 bg-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-2 mb-2 text-purple-500">
            <Cpu className="size-4"/> 
            <span className="text-xs font-bold uppercase">গড় এনালাইসিস সময়</span>
          </div>
          <h3 className="text-4xl font-black">{Math.round(avgAnalysis)}ms</h3>
          <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">Incremental Analysis</p>
        </div>

        <div className="panel p-6 bg-green-500/5 border-green-500/20">
          <div className="flex items-center gap-2 mb-2 text-green-500">
            <Zap className="size-4"/> 
            <span className="text-xs font-bold uppercase">গড় রেসপন্স সময়</span>
          </div>
          <h3 className="text-4xl font-black">{Math.round(avgReply)}ms</h3>
          <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">AI Generation Time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold flex items-center gap-2">
              <BarChart className="size-5 text-primary"/> সাম্প্রতিক মেট্রিক্স
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Live Updates</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 font-bold text-xs uppercase text-muted-foreground">Action</th>
                  <th className="px-4 py-3 font-bold text-xs uppercase text-muted-foreground">Duration</th>
                  <th className="px-4 py-3 font-bold text-xs uppercase text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {metrics.map((m) => (<tr key={m.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="capitalize text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {m.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">{m.duration_ms}ms</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="panel p-6 border-primary/20 bg-primary/5">
            <h2 className="font-bold mb-6 flex items-center gap-2">
              <Settings className="size-5 text-primary"/> কনফিগারেশন
            </h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Maximum Simultaneous Agent Replies</label>
                <input type="number" className="w-full bg-background border rounded-lg px-3 py-2 text-sm font-bold" value={settings.max_simultaneous_replies ?? 5} onChange={(e) => mutation.mutate({ ...settings, max_simultaneous_replies: parseInt(e.target.value) })}/>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-background border">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase">Enable Streaming</label>
                  <p className="text-[10px] text-muted-foreground italic">Instant token-by-token replies.</p>
                </div>
                <input type="checkbox" className="size-5 accent-primary" checked={settings.enable_streaming ?? true} onChange={(e) => mutation.mutate({ ...settings, enable_streaming: e.target.checked })}/>
              </div>
            </div>
          </div>

          <div className="panel p-6 bg-card border-white/5">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-sm italic">
              <Activity className="size-4 text-green-500"/> সিস্টেম স্ট্যাটাস
            </h3>
            <div className="space-y-4">
               <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground">Voice Streaming</span>
                 <span className="font-bold text-green-500">ACTIVE</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground">Incremental Analysis</span>
                 <span className="font-bold text-green-500">OPTIMIZED</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground">Parallel Agents</span>
                 <span className="font-bold text-primary">5 LIMIT</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
function Mic(props) {
    return (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>);
}
