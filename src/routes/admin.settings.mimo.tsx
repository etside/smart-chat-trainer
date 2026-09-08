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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings/mimo")({
  component: MimoSettingsPage,
});

const DEFAULT_MODEL = "qwen/qwen3.8-27b-free";

const MODELS = [
  // OrcaRouter FREE ─────────────────────────
  { id: "qwen/qwen3.8-27b-free",          label: "Qwen 3.8 27B (OrcaRouter FREE)" },
  { id: "deepseek/deepseek-v4-flash-free", label: "DeepSeek V4 Flash (OrcaRouter FREE)" },
  { id: "tencent/hy3-free",               label: "HunyuanLarge 3 (OrcaRouter FREE)" },
  // OrcaRouter paid ─────────────────────────
  { id: "orcarouter/fusion-mini",          label: "OrcaRouter Fusion Mini" },
  { id: "orcarouter/auto",                 label: "OrcaRouter Auto (smart routing)" },
  // Others ──────────────────────────────────
  { id: "google/gemini-2.5-flash",         label: "Gemini 2.5 Flash" },
  { id: "openai/gpt-4o-mini",              label: "GPT-4o Mini" },
  { id: "openai/gpt-4o",                   label: "GPT-4o" },
  { id: "anthropic/claude-haiku-4.5",      label: "Claude Haiku 4.5" },
  // Legacy ──────────────────────────────────
  { id: "mimo-v2.5",     label: "MiMo V2.5 (legacy)" },
  { id: "mimo-v2.5-pro", label: "MiMo V2.5 Pro (legacy)" },
];
const VALID_MODELS = MODELS.map(m => m.id);

function MimoSettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAgentSettings);
  const saveSettings = useServerFn(saveAgentSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["agent-settings"],
    queryFn: () => fetchSettings(),
  });

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [autoApprove, setAutoApprove] = useState(false);
  const [apiKeyOverride, setApiKeyOverride] = useState("");

  useEffect(() => {
    if (!data) return;
    setPrompt(data.system_prompt ?? "");
    setModel(VALID_MODELS.includes(data.model) ? data.model : (data.model || DEFAULT_MODEL));
    setAutoApprove(Boolean(data.auto_approve));
    setApiKeyOverride(data.lovable_api_key_override ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          system_prompt: prompt,
          model,
          auto_approve: autoApprove,
          lovable_api_key_override: apiKeyOverride,
        },
      }),
    onSuccess: () => {
      toast.success("AI settings saved");
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
    },
    onError: (err: any) => toast.error(err.message || "Save failed"),
  });

  if (isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/settings">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            AI / Model Settings
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configure the AI model, system prompt, and automation behavior.{" "}
            <Link to="/admin/api-hub" className="text-primary underline underline-offset-2 text-xs font-semibold">
              → Full API Hub (all providers, keys, routing)
            </Link>
          </p>
        </div>
      </div>

      {/* System Prompt */}
      <div className="panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="size-2 rounded-full bg-primary animate-pulse" />
          <h2 className="text-base font-semibold">System Prompt</h2>
        </div>
        <Textarea
          id="prompt"
          rows={14}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="font-mono text-sm leading-relaxed"
          placeholder="You are a helpful sales agent..."
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Define the agent's tone, language (Bengali/English), and what information it can share.
        </p>
      </div>

      {/* Model Selector */}
      <div className="panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-primary" />
          <h2 className="text-base font-semibold">AI Engine</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
              Model
            </Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
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
            <p className="text-xs text-muted-foreground">
              {model === "mimo-v2.5-pro"
                ? "Higher quality, slower responses. Best for complex queries."
                : "Fast and balanced. Good for most conversations."}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
              Custom API Key (Optional)
            </Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKeyOverride}
              onChange={(e) => setApiKeyOverride(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Override the default API key for this model.
            </p>
          </div>
        </div>
      </div>

      {/* Automation */}
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Auto-Approve</h2>
            <p className="text-xs text-muted-foreground mt-1">
              New training data goes directly to training without manual review.
            </p>
          </div>
          <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="shadow-lg shadow-primary/20"
        >
          <Save className="mr-2 size-4" />
          {mutation.isPending ? "Saving..." : "Save AI Settings"}
        </Button>
      </div>
    </div>
  );
}
