import { createFileRoute } from "@tanstack/react-router";

/**
 * Unified Pipeline Health Endpoint
 *
 * Returns a lightweight JSON summary of the Daddy AI pipeline health:
 * webhook pipeline, catalog sync, voice clone, and general system state.
 * No auth required (read-only health info).
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startTime = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Collect pipeline metrics in parallel
        const [
          syncRunResult,
          webhookLogResult,
          catCountResult,
          cloneResult,
          settingsResult,
          activeSessionsResult,
        ] = await Promise.allSettled([
          // Latest sync run
          supabaseAdmin
            .from("sync_runs")
            .select("status, items_count, started_at, finished_at, error_message")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          // Recent webhook errors (last 24h)
          supabaseAdmin
            .from("webhook_logs")
            .select("processing_status", { count: "exact" })
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .eq("processing_status", "failed"),

          // Product catalogue count
          supabaseAdmin
            .from("product_catalogue")
            .select("id", { count: "exact", head: true }),

          // Active voice clone
          supabaseAdmin
            .from("voice_clones")
            .select("name, provider, quality_score")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          // Settings
          supabaseAdmin
            .from("agent_settings")
            .select("sync_schedule, last_sync_status, last_sync_at, auto_reply_mode, selected_voice_clone_id")
            .eq("id", 1)
            .maybeSingle(),

          // Active conversation sessions
          supabaseAdmin
            .from("conversation_sessions")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
        ]);

        // Build response
        const syncRun = syncRunResult.status === "fulfilled" ? syncRunResult.value.data ?? null : null;
        const webhookFailedCount = webhookLogResult.status === "fulfilled" ? webhookLogResult.value.count ?? 0 : null;
        const catCount = catCountResult.status === "fulfilled" ? catCountResult.value.count ?? 0 : null;
        const activeClone = cloneResult.status === "fulfilled" ? cloneResult.value.data ?? null : null;
        const settings = settingsResult.status === "fulfilled" ? settingsResult.value.data ?? null : null;
        const activeSessions = activeSessionsResult.status === "fulfilled" ? activeSessionsResult.value.count ?? 0 : null;

        return new Response(
          JSON.stringify(
            {
              status: "ok",
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
              pipeline: {
                webhook: {
                  recent_errors_24h: webhookFailedCount,
                  health: webhookFailedCount === 0 ? "good" : webhookFailedCount && webhookFailedCount > 10 ? "degraded" : "warning",
                },
                sync: {
                  last_status: syncRun?.status ?? settings?.last_sync_status ?? "never",
                  last_run: syncRun?.started_at ?? settings?.last_sync_at ?? null,
                  schedule: settings?.sync_schedule ?? "manual",
                  items_count: syncRun?.items_count ?? null,
                  last_error: syncRun?.error_message ?? null,
                },
                catalogue: {
                  product_count: catCount,
                },
                auto_reply: {
                  mode: settings?.auto_reply_mode ?? "off",
                },
                voice_clone: {
                  active: activeClone
                    ? { name: activeClone.name, provider: activeClone.provider, quality: activeClone.quality_score }
                    : null,
                },
                conversations: {
                  active_sessions: activeSessions,
                },
              },
              duration_ms: Date.now() - startTime,
            },
            null,
            2
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});