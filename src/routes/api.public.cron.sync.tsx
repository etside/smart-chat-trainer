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

        // 2. Process Catalog Sync (direct DB access, bypasses auth middleware)
        const { data: settings } = await supabaseAdmin
          .from("agent_settings")
          .select("sync_schedule, last_sync_at, sync_token, sync_secret")
          .eq("id", 1)
          .maybeSingle();

        if (settings?.sync_schedule === "manual") {
          return new Response(JSON.stringify({ status: "done", webhooksProcessed: pendingWebhooks?.length || 0, sync: "skipped" }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        const token = settings?.sync_token || process.env['SYNC_TOKEN'];
        const secret = settings?.sync_secret || process.env['SYNC_SECRET'];
        const syncUrl = "https://api.v2.wearimpressive.com/api/ai/webhook";

        if (!token || !secret) {
          return new Response(JSON.stringify({ error: "Sync credentials not configured", webhooksProcessed: pendingWebhooks?.length || 0 }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }

        try {
          const idempotencyKey = `cron_${new Date().toISOString().slice(0, 13)}`;

          // Check idempotency
          const { data: existing } = await supabaseAdmin
            .from("sync_runs")
            .select("id, status, items_count")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();

          if (existing) {
            return new Response(JSON.stringify({ count: existing.items_count, message: `Already ${existing.status}`, webhooksProcessed: pendingWebhooks?.length || 0 }), {
              headers: { "Content-Type": "application/json" }
            });
          }

          // Create run record
          const { data: run } = await supabaseAdmin
            .from("sync_runs")
            .insert({ status: "processing", source: "cron", idempotency_key: idempotencyKey })
            .select()
            .single();

          // Fetch products
          let allItems: any[] = [];
          let page = 1;
          const perPage = 50;
          let totalPages = 1;

          while (page <= totalPages && page <= 20) {
            const payload = { action: "catalog", per_page: perPage, page, session: `cron_${run?.id || Date.now()}`, token: token.startsWith("Bearer ") ? token.slice(7) : token };
            const bodyStr = JSON.stringify(payload);

            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyStr));
            const sig = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");

            const syncRes = await fetch(syncUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`,
                "X-AI-Signature": `sha256=${sig}`,
                "X-Secret": secret
              },
              body: bodyStr
            });

            if (!syncRes.ok) throw new Error(`Sync API failed: ${syncRes.status}`);
            const apiData = await syncRes.json();
            const pageItems = apiData.success && apiData.data?.products ? apiData.data.products : (Array.isArray(apiData) ? apiData : []);
            allItems = allItems.concat(pageItems);

            if (apiData.data?.last_page) totalPages = apiData.data.last_page;
            else if (pageItems.length < perPage) break;
            page++;
          }

          // Generate training pairs
          const trainingPairs = allItems
            .filter((item: any) => (item.name || item.title) && (item.price || item.effective_price))
            .flatMap((item: any) => {
              const name = item.name || item.title;
              const price = item.effective_price || item.price;
              const stock = item.stock ?? item.stock_status ?? 'Available';
              const category = item.category || '';
              const brand = item.brand || '';
              const desc = item.short_description || item.description || '';
              const pairs = [];
              pairs.push({ question: `${name} এর দাম কত?`, answer: `${name} এর দাম ${price} টাকা।${category ? ` ক্যাটাগরি: ${category}।` : ''}${brand ? ` ব্র্যান্ড: ${brand}।` : ''}`, status: 'approved' as const, source: 'api_sync' });
              pairs.push({ question: `${name} স্টকে আছে কি?`, answer: `${name} এর স্টক: ${stock === 0 || stock === 'out_of_stock' ? 'স্টকে নেই' : 'স্টকে আছে'}।`, status: 'approved' as const, source: 'api_sync' });
              if (desc) pairs.push({ question: `${name} সম্পর্কে জানান`, answer: `${name}: ${desc}। দাম: ${price} টাকা।`, status: 'approved' as const, source: 'api_sync' });
              return pairs;
            }).slice(0, 5000);

          await supabaseAdmin.from("training_pairs").upsert(trainingPairs, { onConflict: 'question' });

          if (run) {
            await supabaseAdmin.from("sync_runs").update({ status: "completed", items_count: trainingPairs.length, finished_at: new Date().toISOString() }).eq("id", run.id);
            await supabaseAdmin.from("agent_settings").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_sync_details: { run_id: run.id, items_count: trainingPairs.length } }).eq("id", 1);
          }

          return new Response(JSON.stringify({ count: trainingPairs.length, message: `Synced ${trainingPairs.length} items`, webhooksProcessed: pendingWebhooks?.length || 0 }), {
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
