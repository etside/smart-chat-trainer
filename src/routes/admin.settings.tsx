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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-4xl">
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
          {mutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel p-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-2 rounded-full bg-primary" />
              <h2 className="text-lg font-bold">এজেন্ট ইনস্ট্রাকশন (System Prompt)</h2>
            </div>
            <Textarea
              id="prompt"
              rows={15}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-sm leading-relaxed bg-muted/30 focus:bg-background transition-all"
              placeholder="আপনি একজন দক্ষ সেলস এজেন্ট..."
            />
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              <strong>টিপস:</strong> আপনি এখানে এজেন্টের টোন, কথা বলার ভাষা (বাংলা/ইংরেজি), এবং কী কী তথ্য শেয়ার করা যাবে তা নির্দিষ্ট করতে পারেন।
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6 bg-card/50">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI ইঞ্জিন
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">মডেল সিলেক্ট করুন</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full bg-background">
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
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Custom API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyOverride}
                  onChange={(e) => setApiKeyOverride(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          <div className="panel p-6 border-l-4 border-l-accent">
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
        </div>
      </div>
    </div>
  );
}
