import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/connections")({
  component: Connections,
});

function Connections() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const fetchKeys = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);

  const { data: keys } = useQuery({ queryKey: ["api-keys"], queryFn: () => fetchKeys() });

  const createMutation = useMutation({
    mutationFn: () => create({ data: { name: name.trim() } }),
    onSuccess: (res) => {
      setNewKey(res.key);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => toast.error("কী তৈরি করা যায়নি।"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const endpoint = `${origin}/api/public/chat`;
  const webhookEndpoint = `${origin}/api/public/webhook`;
  
  const snippet = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"message":"ডেলিভারি চার্জ কত?","channel":"messenger"}'`;

  const webhookSnippet = `curl -X POST ${webhookEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{"message":"আপনার শপ কোথায়?","sender":"customer_123"}'`;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">কানেকশন</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        API key দিয়ে Messenger, WhatsApp, ওয়েবসাইট বা যেকোনো অটোমেশন টুল থেকে এজেন্টকে ব্যবহার
        করুন।
      </p>

      <div className="panel mt-6 space-y-3 p-5">
        <Label htmlFor="key-name">নতুন API key</Label>
        <div className="flex gap-2">
          <Input
            id="key-name"
            placeholder="যেমন: Messenger bot"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            তৈরি করুন
          </Button>
        </div>
        {newKey && (
          <div className="rounded-lg border border-warning bg-warning/10 p-3">
            <p className="text-xs text-muted-foreground">
              এই কী একবারই দেখা যাবে — কপি করে রাখুন।
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-card px-2 py-1.5 text-xs">
                {newKey}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(newKey);
                  toast.success("কপি হয়েছে");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {keys?.map((k) => (
          <div key={k.id} className="panel flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{k.name}</p>
              <p className="text-xs text-muted-foreground">
                {k.key_prefix}••••{" "}
                {k.last_used_at
                  ? `শেষ ব্যবহার ${new Date(k.last_used_at).toLocaleDateString("en-GB")}`
                  : "এখনো ব্যবহার হয়নি"}
              </p>
            </div>
            {k.revoked ? (
              <Badge variant="secondary">বাতিল</Badge>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => revokeMutation.mutate(k.id)}>
                বাতিল করুন
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="panel mt-6 p-5">
        <h2 className="text-base font-semibold">API ইন্টিগ্রেশন</h2>
        <p className="mt-1 text-xs text-muted-foreground">সরাসরি রিপ্লাই পাওয়ার জন্য এই এন্ডপয়েন্ট ব্যবহার করুন:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary p-3 text-xs">{snippet}</pre>
        
        <h2 className="mt-6 text-base font-semibold">ওয়েবহুক (Webhook) ইন্টিগ্রেশন</h2>
        <p className="mt-1 text-xs text-muted-foreground">অন্য প্লাটফর্ম থেকে ইভেন্ট পাঠানোর জন্য এই এন্ডপয়েন্ট ব্যবহার করুন:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary p-3 text-xs">{webhookSnippet}</pre>

        <p className="mt-4 text-sm text-muted-foreground">
          উত্তর আসবে <code>{`{"reply": "..."}`}</code> আকারে। প্রতিটি কল ট্রেনিং ডেটা দেখে উত্তর
          দেয় এবং কথোপকথন সেভ করে রাখে।
        </p>
      </div>
    </div>
  );
}
