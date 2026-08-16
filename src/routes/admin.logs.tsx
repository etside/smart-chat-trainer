import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWebhookLogs, getDataPolicy, updateDataPolicy } from "@/lib/admin-extra.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Terminal, Shield, Save, RefreshCcw, Search, ExternalLink, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/admin/logs")({
  component: AdminLogsPage,
});

function AdminLogsPage() {
  const qc = useQueryClient();
  const fetchLogs = useServerFn(getWebhookLogs);
  const fetchPolicy = useServerFn(getDataPolicy);
  const savePolicy = useServerFn(updateDataPolicy);

  const { data: logs, isLoading: logsLoading } = useQuery({ 
    queryKey: ["webhook-logs"], 
    queryFn: () => fetchLogs(),
    refetchInterval: 10000 // Auto refresh every 10s
  });

  const { data: policy } = useQuery({ 
    queryKey: ["data-policy"], 
    queryFn: () => fetchPolicy() 
  });

  const [policyContent, setPolicyContent] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "policy">("logs");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (policy) setPolicyContent(policy);
  }, [policy]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (content: string) => savePolicy({ data: { content } }),
    onSuccess: () => {
      toast.success("Data policy আপডেট করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["data-policy"] });
    }
  });

  const [redirectTest, setRedirectTest] = useState("");
  const isRedirectValid = redirectTest === `${origin}/auth/callback` || redirectTest === `${origin}/`;

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">অ্যাডমিন কন্ট্রোল সেন্টার</h1>
          <p className="mt-1 text-sm text-muted-foreground italic">Webhook Logs এবং Data Policy ম্যানেজ করুন।</p>
        </div>
        <div className="flex gap-2 bg-muted/20 p-1 rounded-lg border border-white/5">
          <Button 
            variant={activeTab === "logs" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("logs")}
            className="h-8"
          >
            <Terminal className="mr-2 size-4" />
            Webhook Logs
          </Button>
          <Button 
            variant={activeTab === "policy" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("policy")}
            className="h-8"
          >
            <Shield className="mr-2 size-4" />
            Data Policy Editor
          </Button>
        </div>
      </div>

      {activeTab === "logs" ? (
        <div className="space-y-6">
          <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Search className="size-5 text-primary" />
                <h2 className="text-lg font-bold">ইনকামিং ইভেন্ট লগ</h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["webhook-logs"] })}>
                <RefreshCcw className="mr-2 size-3" /> রিফ্রেশ
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-muted-foreground">
                    <th className="pb-3 font-medium">টাইম</th>
                    <th className="pb-3 font-medium">সোর্স</th>
                    <th className="pb-3 font-medium">ইভেন্ট</th>
                    <th className="pb-3 font-medium">স্ট্যাটাস</th>
                    <th className="pb-3 font-medium">পেলোড</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logsLoading ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
                  ) : logs?.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">কোনো লগ পাওয়া যায়নি</td></tr>
                  ) : logs?.map((log: any) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 text-xs font-mono">{new Date(log.created_at).toLocaleString('bn-BD')}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.source === 'meta' ? 'bg-[#1877F2]/20 text-[#1877F2]' : 'bg-primary/20 text-primary'
                        }`}>
                          {log.source}
                        </span>
                      </td>
                      <td className="py-4 font-medium">{log.event_type}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status_code >= 200 && log.status_code < 300 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                        }`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="py-4 max-w-xs truncate font-mono text-[10px] text-muted-foreground">
                        {JSON.stringify(log.payload)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-6 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-500">Redirect URI Validation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Meta Login-এর জন্য আপনার রিডাইরেক্ট ইউআরআই অবশ্যই নিচের মতো হতে হবে। এটি ভুল হলে "URL Blocked" এরর দেখাবে।
                </p>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">টেস্ট করুন আপনার URI:</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="https://..." 
                        value={redirectTest} 
                        onChange={(e) => setRedirectTest(e.target.value)}
                        className={`bg-background font-mono text-xs ${
                          redirectTest && !isRedirectValid ? 'border-destructive ring-1 ring-destructive' : ''
                        }`}
                      />
                      {redirectTest && (
                        <div className={`flex items-center px-3 rounded text-[10px] font-bold uppercase ${
                          isRedirectValid ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                        }`}>
                          {isRedirectValid ? 'Valid' : 'Invalid'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-black/20 font-mono text-xs break-all">
                    প্রয়োজনীয় URI: <span className="text-primary">{origin}/auth/callback</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                <h2 className="text-lg font-bold">Data Policy (Markdown)</h2>
              </div>
              <Button 
                onClick={() => saveMutation.mutate(policyContent)}
                disabled={saveMutation.isPending}
              >
                <Save className="mr-2 size-4" />
                {saveMutation.isPending ? "সেভ হচ্ছে..." : "পলিসি সেভ করুন"}
              </Button>
            </div>

            <Textarea 
              value={policyContent}
              onChange={(e) => setPolicyContent(e.target.value)}
              rows={20}
              className="font-mono text-sm bg-muted/20 border-white/5 focus:bg-background transition-all"
              placeholder="# Data Deletion Policy..."
            />
            
            <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold">Public Policy URL</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 italic">Meta ডেভেলপার প্যানেলে এই লিঙ্কটি ব্যবহার করুন।</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/data-deletion" target="_blank">
                    <ExternalLink className="mr-2 size-3" /> ভিউ পেজ
                  </a>
                </Button>
              </div>
              <div className="mt-3 p-2 bg-black/20 rounded font-mono text-xs break-all select-all">
                {origin}/data-deletion
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
