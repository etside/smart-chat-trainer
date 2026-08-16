import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAgentSettings, saveAgentSettings } from "@/lib/console.functions";
import { getSyncCredentials, updateSyncCredentials } from "@/lib/settings.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Key, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const MODELS = [
  { id: "openai/gpt-5.6-sol", label: "Daddy High-Performance (GPT-5.6 Sol)" },
  { id: "openai/gpt-5.6-terra", label: "Daddy Balanced (GPT-5.6 Terra)" },
  { id: "openai/gpt-5.6-luna", label: "Daddy Fast & Light (GPT-5.6 Luna)" },
];

function SettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAgentSettings);
  const save = useServerFn(saveAgentSettings);

  const { data } = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-5.6-sol");
  const [autoApprove, setAutoApprove] = useState(false);
  const [apiKeyOverride, setApiKeyOverride] = useState("");

  const [syncToken, setSyncToken] = useState("");
  const [syncSecret, setSyncSecret] = useState("");

  const fetchSyncCreds = useServerFn(getSyncCredentials);
  const saveSyncCreds = useServerFn(updateSyncCredentials);

  const { data: syncData } = useQuery({ queryKey: ["sync-credentials"], queryFn: () => fetchSyncCreds() });

  useEffect(() => {
    if (syncData) {
      setSyncToken(syncData.token || "");
      setSyncSecret(syncData.secret || "");
    }
  }, [syncData]);

  useEffect(() => {
    if (!data) return;
    setPrompt(data.system_prompt ?? "");
    setModel(data.model ?? "openai/gpt-5.6-sol");
    setAutoApprove(Boolean(data.auto_approve));
    setApiKeyOverride(data.lovable_api_key_override ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { 
        system_prompt: prompt, 
        model, 
        auto_approve: autoApprove,
        lovable_api_key_override: apiKeyOverride
      } }),
    onSuccess: () => {
      toast.success("সেটিংস সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
    },
    onError: () => toast.error("সেভ করা যায়নি।"),
  });

  const updateCredsMutation = useMutation({
    mutationFn: () => saveSyncCreds({ data: { token: syncToken, secret: syncSecret } }),
    onSuccess: () => {
      toast.success("সিঙ্ক ক্রেডেনশিয়াল সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["sync-credentials"] });
    },
    onError: (err: any) => toast.error(err.message || "সেভ করা যায়নি।"),
  });

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">সেটিংস</h1>
          <p className="mt-1 text-sm text-muted-foreground italic">Daddy AI-এর ব্যক্তিত্ব ও নিয়মাবলী কনফিগার করুন।</p>
        </div>
        <Button 
          size="lg" 
          onClick={() => mutation.mutate()} 
          disabled={mutation.isPending}
          className="shadow-xl shadow-primary/20"
        >
          <Save className="mr-2 size-4" />
          {mutation.isPending ? "সেভ হচ্ছে..." : "সব সেটিংস সেভ করুন"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-lg font-bold">এজেন্ট ইনস্ট্রাকশন (System Prompt)</h2>
            </div>
            <Textarea
              id="prompt"
              rows={12}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-sm leading-relaxed bg-muted/20 border-white/5 focus:bg-background transition-all focus:ring-1 focus:ring-primary/50"
              placeholder="আপনি একজন দক্ষ সেলস এজেন্ট..."
            />
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
              <Sparkles className="size-3 mt-0.5 text-primary shrink-0" />
              <span>
                <strong>টিপস:</strong> আপনি এখানে এজেন্টের টোন, কথা বলার ভাষা (বাংলা/ইংরেজি), এবং কী কী তথ্য শেয়ার করা যাবে তা নির্দিষ্ট করতে পারেন।
              </span>
            </p>
          </div>

          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Key className="size-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">API সিঙ্ক ক্রেডেনশিয়াল</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => updateCredsMutation.mutate()}
                disabled={updateCredsMutation.isPending}
                className="h-8 text-xs font-semibold"
              >
                {updateCredsMutation.isPending ? "সেভ হচ্ছে..." : "ক্রেডেনশিয়াল আপডেট করুন"}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Sync Token</Label>
                <Input
                  type="password"
                  placeholder={syncData?.token ? "••••••••" : "ব্যাকএন্ড টোকেন দিন"}
                  value={syncToken}
                  onChange={(e) => setSyncToken(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Sync Secret</Label>
                <Input
                  type="password"
                  placeholder={syncData?.secret ? "••••••••" : "ব্যাকএন্ড সিক্রেট দিন"}
                  value={syncSecret}
                  onChange={(e) => setSyncSecret(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground bg-primary/5 p-3 rounded-md border border-primary/10">
              নিরাপত্তার স্বার্থে টোকেন এবং সিক্রেট মাস্ক করে দেখানো হচ্ছে। নতুন মান সেভ করলে আগেরগুলো ওভাররাইট হবে।
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6 bg-card/60 backdrop-blur-sm border-white/5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI ইঞ্জিন
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">মডেল সিলেক্ট করুন</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full bg-background/50 border-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Custom API Key (Optional)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyOverride}
                  onChange={(e) => setApiKeyOverride(e.target.value)}
                  className="bg-background/50 border-white/5"
                />
              </div>
            </div>
          </div>

          <div className="panel p-6 border-l-4 border-l-accent bg-accent/5 backdrop-blur-sm">
            <h2 className="font-bold mb-4">অটোমেশন</h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">অটো-অ্যাপ্রুভ</p>
                <p className="text-xs text-muted-foreground">
                  নতুন ডেটা সরাসরি ট্রেনিংয়ে যাবে।
                </p>
              </div>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>
          </div>

          <div className="panel p-6 border-l-4 border-l-primary bg-primary/5 backdrop-blur-sm">
            <h2 className="font-bold mb-4">কুইক লিংক</h2>
            <div className="space-y-3">
              <Link to="/admin/webhook-test">
                <Button variant="outline" size="sm" className="w-full justify-start border-white/10 hover:bg-white/5">
                  প্লাটফর্ম টেস্ট রান
                </Button>
              </Link>
              <Link to="/admin/sync">
                <Button variant="ghost" size="sm" className="w-full justify-start hover:bg-white/5">
                  সিঙ্ক স্ট্যাটাস লগ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
