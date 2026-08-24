import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");

        // Try agent_settings.cron_secret first, fall back to env var
        let cronSecret = process.env['CRON_SECRET'];
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: settings } = await supabaseAdmin
            .from("agent_settings")
            .select("cron_secret")
            .eq("id", 1)
            .maybeSingle();
          if ((settings as any)?.cron_secret) {
            cronSecret = (settings as any).cron_secret;
          }
        } catch (e) {
          // Fall back to env var silently
        }

        if (!cronSecret) {
          console.error("CRON_SECRET not configured in agent_settings or env.");
          return new Response("Configuration Error", { status: 500 });
        }

        if (authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { syncCatalog } = await import("@/lib/sync.functions");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processWebhookRetry } = await import("@/routes/api.public.webhook");

        // 1. Process Webhook Retries
        const { data: pendingWebhooks } = await supabaseAdmin
          .from("webhook_logs")
          .select("id")
          .eq("processing_status", "pending")
          .lte("next_retry_at", new Date().toISOString());

        if (pendingWebhooks && pendingWebhooks.length > 0) {
          console.log(`Processing ${pendingWebhooks.length} webhook retries...`);
          for (const hook of pendingWebhooks) {
            await processWebhookRetry(hook.id);
          }
        }

        // 2. Process Catalog Sync
        const { data: settings } = await supabaseAdmin
          .from("agent_settings")
          .select("sync_schedule, last_sync_at")
          .eq("id", 1)
          .maybeSingle();

        if (settings?.sync_schedule === "manual") {
          return new Response(JSON.stringify({ status: "done", webhooksProcessed: pendingWebhooks?.length || 0, sync: "skipped" }), {
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

          return new Response(JSON.stringify({ ...result, webhooksProcessed: pendingWebhooks?.length || 0 }), {
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
