import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy, Key, Loader2, Plus, RefreshCw, ShieldCheck, Trash2,
  KeyRound, Info, AlertTriangle, Check, X, Eye, EyeOff,
  Clock, Activity, Hash, Server, Users, Terminal,
  Sparkles, Download, Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [showRevoked, setShowRevoked] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => fetchKeys(),
    staleTime: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => create({ data: { name } }),
    onSuccess: (res) => {
      setNewKey(res.key);
      setNewName("");
      toast.success("API Key তৈরি হয়েছে");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => toast.error("API Key তৈরি ব্যর্থ হয়েছে।"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("API Key বাতিল করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotate({ data: { id } }),
    onSuccess: (res) => {
      setNewKey(res.key);
      toast.success("API Key রোটেট করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const filteredKeys = (keys ?? []).filter((k: any) => {
    if (searchTerm && !k.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (!showRevoked && k.revoked) return false;
    return true;
  });

  const activeCount = (keys ?? []).filter((k: any) => !k.revoked).length;
  const revokedCount = (keys ?? []).filter((k: any) => k.revoked).length;

  return (
    <div className="mx-auto max-w-5xl pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="size-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground ml-[52px]">
            Manage API keys for external integrations. Use <code className="text-primary bg-muted/30 px-1 rounded text-[10px]">X-API-Key</code> or{' '}
            <code className="text-primary bg-muted/30 px-1 rounded text-[10px]">Authorization: Bearer {"<KEY>"}</code> header.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
          <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Active</div>
          <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
        </div>
        <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
          <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Revoked</div>
          <p className="text-2xl font-bold text-muted-foreground">{revokedCount}</p>
        </div>
        <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
          <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Total Created</div>
          <p className="text-2xl font-bold">{(keys ?? []).length}</p>
        </div>
        <div className="panel p-4 bg-card/40 backdrop-blur-sm border-white/5">
          <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Security</div>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">SHA-256</span>
          </div>
        </div>
      </div>

      {/* Error callout if showing a newly created key */}
      {newKey && (
        <div className="panel p-6 bg-emerald-500/5 border-emerald-500/20 border-t-4 border-t-emerald-500 mb-6 animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-emerald-400">New API Key Created</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground"
                  onClick={() => { setNewKey(null); }}
                >
                  <X className="size-3" /> Dismiss
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Copy this key now — it <strong className="text-destructive">will not be shown again</strong>.
              </p>
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 block p-3 rounded-xl bg-black/40 font-mono text-sm break-all text-primary select-all border border-white/5">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(newKey);
                    setCopiedKey(newKey);
                    toast.success("কী কপি করা হয়েছে");
                    setTimeout(() => setCopiedKey(null), 2000);
                  }}
                >
                  {copiedKey === newKey ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  {copiedKey === newKey ? "Copied!" : "Copy"}
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                <AlertTriangle className="size-3 shrink-0" />
                <span>Store this key securely. It cannot be retrieved later.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Panel */}
      <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="size-4 text-primary" />
          <h2 className="text-lg font-bold">Create New Key</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Key Name</Label>
            <Input
              placeholder="e.g. Meta Platform Sync"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-muted/20 border-white/5"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim() && !createMutation.isPending) {
                  createMutation.mutate(newName.trim());
                }
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newName.trim())}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Key className="size-4" />
              )}
              Generate Key
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Keys are hashed with <strong className="text-primary">SHA-256</strong> before storage. The raw key is shown only once.
        </p>
      </div>

      {/* Keys List */}
      <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> Keys
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                className="pl-8 h-8 w-48 bg-muted/20 border-white/5 text-xs"
                placeholder="Search keys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowRevoked(!showRevoked)}
              className={cn(
                "text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all",
                showRevoked
                  ? "bg-muted/30 text-foreground border-border/40"
                  : "text-muted-foreground border-border/20 hover:border-border/40"
              )}
            >
              {showRevoked ? "Showing All" : "Hide Revoked"}
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[10px]"
              onClick={() => qc.invalidateQueries({ queryKey: ["api-keys"] })}
            >
              <RefreshCw className="size-3 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="py-12 text-center">
            <KeyRound className="size-12 mx-auto text-muted-foreground opacity-20 mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? "No keys match your search." : "No API keys yet. Create one above."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredKeys.map((key: any) => (
              <div
                key={key.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all",
                  key.revoked
                    ? "bg-muted/10 border-border/10 opacity-60"
                    : "bg-muted/20 border-white/5 hover:border-primary/20 hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    "size-2.5 rounded-full shrink-0",
                    key.revoked ? "bg-destructive/50" : "bg-emerald-500 animate-pulse"
                  )} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{key.name}</p>
                      {key.revoked && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                          Revoked
                        </span>
                      )}
                      {key.version_id && (
                        <span className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                          v:{key.version_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        <Hash className="size-2.5 inline mr-1" />
                        {key.key_prefix}...
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        <Clock className="size-2.5 inline mr-1" />
                        Created {new Date(key.created_at).toLocaleDateString("bn-BD")}
                      </span>
                      {key.last_used_at && (
                        <span className="text-[10px] text-muted-foreground">
                          <Activity className="size-2.5 inline mr-1" />
                          Last used {new Date(key.last_used_at).toLocaleDateString("bn-BD")}
                        </span>
                      )}
                      {!key.last_used_at && !key.revoked && (
                        <span className="text-[10px] text-amber-400/70">
                          <Info className="size-2.5 inline mr-1" />
                          Never used
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!key.revoked && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-primary hover:bg-primary/10"
                        onClick={() => rotateMutation.mutate(key.id)}
                        disabled={rotateMutation.isPending}
                        title="Rotate Key"
                      >
                        <RefreshCw className={cn("size-3.5", rotateMutation.isPending && "animate-spin")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Revoke API key "${key.name}"? This cannot be undone.`)) {
                            revokeMutation.mutate(key.id);
                          }
                        }}
                        disabled={revokeMutation.isPending}
                        title="Revoke Key"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Guide */}
      <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="size-5 text-primary" />
          <h2 className="text-lg font-bold">Usage Examples</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Header Auth</p>
            <code className="block p-3 rounded-xl bg-black/40 font-mono text-[11px] text-primary border border-white/5">
              curl -X POST https://daddyai.online/api/public/webhook &#92;<br />
              &nbsp;&nbsp;-H "X-API-Key: your-key-here" &#92;<br />
              &nbsp;&nbsp;-H "Content-Type: application/json" &#92;<br />
              &nbsp;&nbsp;-d &#123;"message":"Hello"&#125;
            </code>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Bearer Token</p>
            <code className="block p-3 rounded-xl bg-black/40 font-mono text-[11px] text-primary border border-white/5">
              curl -X POST https://daddyai.online/api/public/webhook &#92;<br />
              &nbsp;&nbsp;-H "Authorization: Bearer your-key-here" &#92;<br />
              &nbsp;&nbsp;-H "Content-Type: application/json" &#92;<br />
              &nbsp;&nbsp;-d &#123;"message":"Hello"&#125;
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}