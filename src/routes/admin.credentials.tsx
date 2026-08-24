import { Button } from "@/components/ui/button";
import {
  getDeliverySecrets,
  getMyPlatformCredentials,
  regeneratePlatformCredential,
  rotateDeliverySecret,
} from "@/lib/tenant-credentials.functions";
import { getMyRole } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/credentials")({
  component: CredentialsPage,
});

const PLATFORM_LABELS: Record<string, string> = {
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Website Chat",
};

function SecretField({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-secondary px-2 py-1.5 text-xs">
          {shown ? value : `${value.slice(0, 8)}${"•".repeat(16)}`}
        </code>
        <Button size="icon" variant="ghost" className="size-8" onClick={() => setShown((s) => !s)}>
          {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("কপি হয়েছে");
          }}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function CredentialsPage() {
  const qc = useQueryClient();
  const fetchCreds = useServerFn(getMyPlatformCredentials);
  const regenerate = useServerFn(regeneratePlatformCredential);
  const fetchSecrets = useServerFn(getDeliverySecrets);
  const rotate = useServerFn(rotateDeliverySecret);
  const fetchRole = useServerFn(getMyRole);

  const roleQuery = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const isAdmin = roleQuery.data?.role === "admin";

  const { data: creds, isLoading } = useQuery({
    queryKey: ["tenant-credentials"],
    queryFn: () => fetchCreds(),
  });

  const secretsQuery = useQuery({
    queryKey: ["delivery-secrets"],
    queryFn: () => fetchSecrets(),
    enabled: isAdmin,
  });

  const regenMutation = useMutation({
    mutationFn: (platform: string) => regenerate({ data: { platform: platform as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-credentials"] });
      toast.success("নতুন ক্রেডেনশিয়াল তৈরি হয়েছে");
    },
    onError: () => toast.error("রিজেনারেট করা যায়নি"),
  });

  const rotateMutation = useMutation({
    mutationFn: (kind: "webhook" | "cron") => rotate({ data: { kind } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-secrets"] });
      toast.success("সিক্রেট রোটেট হয়েছে");
    },
    onError: () => toast.error("রোটেট করা যায়নি"),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-500 pb-20">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
        <KeyRound className="size-8 text-primary" /> প্ল্যাটফর্ম ক্রেডেনশিয়াল
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        সাইন-আপের সময় প্রতিটি প্ল্যাটফর্মের জন্য আলাদা টোকেন ও সিক্রেট স্বয়ংক্রিয়ভাবে তৈরি হয়।
        প্রয়োজনে এখান থেকে রিজেনারেট করুন।
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {creds?.map((c: any) => (
          <div key={c.id} className="panel panel-hover space-y-3 p-5 border-l-4 border-l-primary/30">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{PLATFORM_LABELS[c.platform] ?? c.platform}</h2>
              <Button
                size="sm"
                variant="outline"
                disabled={regenMutation.isPending}
                onClick={() => regenMutation.mutate(c.platform)}
              >
                {regenMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                <span className="ml-2">রিজেনারেট</span>
              </Button>
            </div>
            <SecretField label="Client Token" value={c.client_token} />
            <SecretField label="Client Secret" value={c.client_secret} />
            <SecretField label="Webhook Verify Token" value={c.webhook_verify_token} />
            <p className="text-[10px] text-muted-foreground">
              {c.rotated_at
                ? `শেষ রোটেশন: ${new Date(c.rotated_at).toLocaleString("en-GB")}`
                : `তৈরি: ${new Date(c.created_at).toLocaleString("en-GB")}`}
            </p>
          </div>
        ))}
      </div>

      {isAdmin && secretsQuery.data && (
        <div className="panel mt-8 space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="size-5 text-primary" /> ডেলিভারি সিক্রেট
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <SecretField label="Webhook Secret (HMAC)" value={secretsQuery.data.webhook_secret!} />
              <Button size="sm" variant="ghost" onClick={() => rotateMutation.mutate("webhook")}>
                <RefreshCw className="size-3.5 mr-2" /> রোটেট করুন
              </Button>
            </div>
            <div className="space-y-2">
              <SecretField label="Cron Secret" value={secretsQuery.data.cron_secret!} />
              <Button size="sm" variant="ghost" onClick={() => rotateMutation.mutate("cron")}>
                <RefreshCw className="size-3.5 mr-2" /> রোটেট করুন
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
