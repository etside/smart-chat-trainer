import { Button } from "@/components/ui/button";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const MODELS = [
  { id: "openai/gpt-5.6-sol", label: "সবচেয়ে ভালো (GPT-5.6 Sol)" },
  { id: "openai/gpt-5.6-terra", label: "ব্যালান্সড (GPT-5.6 Terra)" },
  { id: "openai/gpt-5.6-luna", label: "দ্রুত ও সাশ্রয়ী (GPT-5.6 Luna)" },
];

function SettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAgentSettings);
  const save = useServerFn(saveAgentSettings);

  const { data } = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-5.6-sol");
  const [autoApprove, setAutoApprove] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPrompt(data.system_prompt ?? "");
    setModel(data.model ?? "openai/gpt-5.6-sol");
    setAutoApprove(Boolean(data.auto_approve));
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { system_prompt: prompt, model, auto_approve: autoApprove } }),
    onSuccess: () => {
      toast.success("সেটিংস সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
    },
    onError: () => toast.error("সেভ করা যায়নি।"),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">সেটিংস</h1>
      <p className="mt-1 text-sm text-muted-foreground">এজেন্টের ব্যক্তিত্ব ও নিয়ম ঠিক করুন।</p>

      <div className="panel mt-6 space-y-5 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="prompt">সিস্টেম প্রম্পট</Label>
          <Textarea
            id="prompt"
            rows={12}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            এজেন্ট কীভাবে কথা বলবে, কী করবে না — সব এখানে লিখুন।
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>মডেল</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-72">
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

        <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary/60 p-4">
          <div>
            <p className="text-sm font-medium">নতুন ডেটা স্বয়ংক্রিয়ভাবে অ্যাপ্রুভ</p>
            <p className="text-xs text-muted-foreground">
              বন্ধ থাকলে নতুন জোড়াগুলো রিভিউয়ের অপেক্ষায় থাকবে।
            </p>
          </div>
          <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
        </div>

        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </div>
  );
}
