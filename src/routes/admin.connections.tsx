import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { testWearImpressiveConnection } from "@/lib/settings.functions";
import { syncCatalog, getSyncRuns, getSyncSettings, updateSyncSchedule } from "@/lib/sync.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Server,
  Store,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/connections")({
  component: Connections,
});

function Connections() {
  const qc = useQueryClient();
  const testConnection = useServerFn(testWearImpressiveConnection);
  const runSync = useServerFn(syncCatalog);
  const updateSchedule = useServerFn(updateSyncSchedule);

  const [connectionStatus, setConnectionStatus] = useState<{
    ok: boolean;
    data?: any;
    error?: string;
  } | null>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [stockResult, setStockResult] = useState<any>(null);

  const { data: syncRuns } = useQuery({
    queryKey: ["sync-runs"],
    queryFn: () => getSyncRuns(),
  });

  const { data: syncSettings } = useQuery({
    queryKey: ["sync-settings"],
    queryFn: () => getSyncSettings(),
  });

  const testMutation = useMutation({
    mutationFn: (action: "catalog" | "stock" | "store_info") =>
      testConnection({ data: { action } }),
    onSuccess: (res) => {
      setConnectionStatus(res);
      if (res.ok) toast.success("API connected successfully");
      else toast.error(res.error || "Connection failed");
    },
    onError: () => toast.error("Connection test failed"),
  });

  const syncMutation = useMutation({
    mutationFn: () => runSync({ data: { idempotencyKey: `manual_${Date.now()}` } }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["sync-runs"] });
      qc.invalidateQueries({ queryKey: ["sync-settings"] });
      if (res) toast.success(res.message || `Synced ${res.count ?? 0} items`);
      else toast.error("Sync failed");
    },
    onError: () => toast.error("Sync failed"),
  });

  const stockMutation = useMutation({
    mutationFn: (productId: string) =>
      testConnection({ data: { action: "stock", productId: Number(productId) } }),
    onSuccess: (res) => {
      setStockResult(res);
    },
  });

  const lastRun = syncRuns?.[0];
  const lastSyncTime = lastRun?.started_at
    ? new Date(lastRun.started_at).toLocaleString("en-GB")
    : "Never";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wear Impressive Connection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API integration with the Wear Impressive e-commerce backend for real-time inventory, stock, and product data.
        </p>
      </div>

      {/* Connection Status */}
      <div className="panel p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Store className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">API Endpoint</h2>
              <p className="text-xs text-muted-foreground font-mono">
                api.v2.wearimpressive.com/api/ai/webhook
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus && (
              <Badge variant={connectionStatus.ok ? "default" : "destructive"}>
                {connectionStatus.ok ? (
                  <><CheckCircle2 className="mr-1 size-3" /> Connected</>
                ) : (
                  <><XCircle className="mr-1 size-3" /> Failed</>
                )}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate("store_info")}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Activity className="mr-1 size-3" />
              )}
              Test Connection
            </Button>
          </div>
        </div>

        {connectionStatus?.data && (
          <div className="mt-4 rounded-lg bg-secondary/50 p-4 text-xs space-y-1">
            <p className="font-medium text-sm mb-2">Store Info</p>
            <p><span className="text-muted-foreground">Store:</span> {connectionStatus.data.store?.name}</p>
            <p><span className="text-muted-foreground">Phone:</span> {connectionStatus.data.store?.phone}</p>
            <p><span className="text-muted-foreground">Currency:</span> {connectionStatus.data.store?.currency}</p>
            <p><span className="text-muted-foreground">Timezone:</span> {connectionStatus.data.store?.timezone}</p>
          </div>
        )}

        {connectionStatus?.error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-4 text-xs text-destructive">
            {connectionStatus.error}
          </div>
        )}
      </div>

      {/* Sync Controls */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
              <RefreshCw className="size-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Catalog Sync</h2>
              <p className="text-xs text-muted-foreground">
                Pull products from Wear Impressive into training data
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3" />
            )}
            Sync Now
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground mb-1">Schedule</p>
            <select
              className="w-full bg-transparent font-medium text-sm border rounded px-2 py-1"
              value={syncSettings?.sync_schedule || "manual"}
              onChange={(e) => {
                updateSchedule({ data: { schedule: e.target.value as any } });
                qc.invalidateQueries({ queryKey: ["sync-settings"] });
              }}
            >
              <option value="manual">Manual</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground mb-1">Last Sync</p>
            <p className="font-medium text-sm">{lastSyncTime}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground mb-1">Status</p>
            <Badge variant={lastRun?.status === "completed" ? "default" : lastRun?.status === "failed" ? "destructive" : "secondary"}>
              {lastRun?.status || "No runs"}
            </Badge>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-muted-foreground mb-1">Products</p>
            <p className="font-medium text-sm">
              {lastRun?.items_count ?? 0} synced
            </p>
          </div>
        </div>

        {syncMutation.data && (
          <div className="mt-4 rounded-lg bg-green-500/10 p-4 text-xs">
            <p className="font-medium text-green-600 mb-1">Sync Complete</p>
            <p>{syncMutation.data.message}</p>
          </div>
        )}
      </div>

      {/* Stock Query */}
      <div className="panel p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Package className="size-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Stock Lookup</h2>
            <p className="text-xs text-muted-foreground">
              Check real-time inventory from the API
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Product ID (e.g. 344)"
            value={stockQuery}
            onChange={(e) => setStockQuery(e.target.value)}
            type="number"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!stockQuery) return;
              stockMutation.mutate(stockQuery);
            }}
            disabled={stockMutation.isPending}
          >
            {stockMutation.isPending ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <Search className="mr-1 size-3" />
            )}
            Check Stock
          </Button>
        </div>

        {stockResult && (
          <div className="mt-4 rounded-lg bg-secondary/50 p-4 text-xs">
            <pre className="overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(stockResult.data || stockResult.error, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Recent Sync Runs */}
      {syncRuns && syncRuns.length > 0 && (
        <div className="panel p-5">
          <h2 className="text-base font-semibold mb-3">Recent Sync Runs</h2>
          <div className="space-y-2">
            {syncRuns.slice(0, 5).map((run) => (
              <div key={run.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 text-xs">
                <div className="flex items-center gap-3">
                  <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                    {run.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {run.started_at ? new Date(run.started_at).toLocaleString("en-GB") : "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{run.items_count ?? 0} items</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Reference */}
      <div className="panel p-5">
        <h2 className="text-base font-semibold mb-3">API Reference</h2>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Server className="size-3" />
            <span className="font-mono">POST /api/ai/webhook</span>
            <span>- Action dispatcher (catalog, stock, orders)</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="size-3" />
            <span className="font-mono">GET /api/ai-sync/products</span>
            <span>- Product list with pagination</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="size-3" />
            <span className="font-mono">GET /api/ai-sync/inventory</span>
            <span>- Branch stock levels</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="size-3" />
            <span className="font-mono">GET /api/ai-sync/orders</span>
            <span>- Recent orders (no PII)</span>
          </div>
        </div>
        <a
          href="https://api.v2.wearimpressive.com/api/store/info"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View Store API <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}
