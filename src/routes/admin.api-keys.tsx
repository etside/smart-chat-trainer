import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Key, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/api-keys")({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const qc = useQueryClient();
  const fetchKeys = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const rotate = useServerFn(rotateApiKey);

  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => fetchKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => create({ data: { name } }),
    onSuccess: (res) => {
      setNewKey(res.key);
      setNewName("");
      toast.success("API Key তৈরি হয়েছে");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("API Key বাতিল করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotate({ data: { id } }),
    onSuccess: (res) => {
      setNewKey(res.key);
      toast.success("API Key রোটেট করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground italic">
            এক্সটার্নাল প্ল্যাটফর্ম থেকে ডেটা সিঙ্ক করার জন্য কী ব্যবহার করুন।
          </p>
        </div>
      </div>

      <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus className="size-5 text-primary" />
          নতুন কী তৈরি করুন
        </h2>
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="key-name">কী-এর নাম</Label>
            <Input 
              id="key-name"
              placeholder="যেমন: Meta Platform Sync"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-muted/20 border-white/5"
            />
          </div>
          <Button 
            className="mt-8"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate(newName)}
          >
            {createMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Key className="mr-2 size-4" />}
            কী জেনারেট করুন
          </Button>
        </div>

        {newKey && (
          <div className="mt-6 p-4 rounded-lg bg-success/10 border border-success/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-success flex items-center gap-2">
                <ShieldCheck className="size-4" />
                আপনার নতুন API Key তৈরি হয়েছে!
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px]" 
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  toast.success("কী কপি করা হয়েছে");
                }}
              >
                <Copy className="mr-2 size-3" /> কপি করুন
              </Button>
            </div>
            <code className="block p-3 rounded bg-black/40 font-mono text-sm break-all text-primary select-all">
              {newKey}
            </code>
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              * গুরুত্বপূর্ণ: এই কী-টি শুধুমাত্র একবারই দেখানো হবে। এখনই এটি কপি করে নিরাপদ জায়গায় রাখুন।
            </p>
          </div>
        )}
      </div>

      <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          সক্রিয় API Keys
        </h2>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : keys?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground italic">কোনো কী পাওয়া যায়নি।</p>
          ) : keys?.map((key: any) => (
            <div key={key.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-white/5 hover:bg-white/5 transition-all">
              <div className="flex items-center gap-4">
                <div className={`size-3 rounded-full ${key.revoked ? 'bg-destructive/50' : 'bg-success animate-pulse'}`} />
                <div>
                  <p className="font-bold text-sm">{key.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Prefix: {key.key_prefix}... • Created: {new Date(key.created_at).toLocaleDateString('bn-BD')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">শেষ ব্যবহার</p>
                  <p className="text-[11px] font-mono">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('bn-BD') : 'ব্যবহার হয়নি'}
                  </p>
                </div>
                {!key.revoked && (
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-primary hover:bg-primary/10"
                      onClick={() => rotateMutation.mutate(key.id)}
                      disabled={rotateMutation.isPending}
                      title="Rotate Key"
                    >
                      <RefreshCw className={`size-4 ${rotateMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => revokeMutation.mutate(key.id)}
                      disabled={revokeMutation.isPending}
                      title="Revoke Key"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
                {key.revoked && (
                  <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded uppercase font-bold">বাতিল</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}