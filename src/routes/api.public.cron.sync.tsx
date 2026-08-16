import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Simple secret check for cron jobs
        const authHeader = request.headers.get("Authorization");
        const cronSecret = process.env['CRON_SECRET'] || "wi_internal_cron_secret";
        
        if (authHeader !== `Bearer ${cronSecret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { syncCatalog } = await import("@/lib/sync.functions");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Fetch settings to check schedule (manual cron would call this, so we check if sync is due)
        const { data: settings } = await supabaseAdmin
          .from("agent_settings")
          .select("sync_schedule, last_sync_at")
          .eq("id", 1)
          .maybeSingle();

        if (settings?.sync_schedule === "manual") {
          return new Response(JSON.stringify({ status: "skipped", reason: "Manual sync only" }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        // Ideally here we check timestamps, but for now we allow the trigger
        try {
          // We need a context-like object or a way to bypass admin check for internal cron
          // Refactor note: trigger directly from server logic
          const result = await (syncCatalog as any).handler({ 
            context: { 
              supabase: supabaseAdmin, 
              userId: "system_cron" // This needs handling in assertAdmin if we want bypass
            },
            data: { idempotencyKey: `cron_${new Date().toISOString().slice(0, 13)}` }
          });

          await supabaseAdmin.from("agent_settings").update({ last_sync_at: new Date().toISOString() }).eq("id", 1);

          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
