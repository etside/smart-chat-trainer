import { createFileRoute } from "@tanstack/react-router";

/**
 * Stock Change Webhook - Wear Impressive → Daddy AI
 *
 * Receives stock change notifications from Wear Impressive ERP
 * and updates training pairs in real-time so the AI agent always
 * has accurate stock information for customer conversations.
 *
 * Expected payload from Wear Impressive:
 * {
 *   "event": "stock_changed" | "product_updated" | "product_created",
 *   "product_id": "string",
 *   "name": "string",
 *   "sku": "string",
 *   "stock": number,
 *   "previous_stock": number,
 *   "price": "string",
 *   "category": "string",
 *   "variants": [...],
 *   "timestamp": "ISO date string"
 * }
 *
 * Authentication: HMAC-SHA256 signature via X-AI-Signature header
 */
export const Route = createFileRoute("/api/public/webhook/stock-change")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();

        try {
          // 1. Read body for signature verification
          const bodyText = await request.text();
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(bodyText);
          } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 2. Verify HMAC signature
          const signature = request.headers.get("x-ai-signature");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: settings } = await supabaseAdmin
            .from("agent_settings")
            .select("sync_secret")
            .eq("id", 1)
            .maybeSingle();

          const secret = settings?.sync_secret || process.env["SYNC_SECRET"];

          if (secret && signature) {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
              "raw",
              encoder.encode(secret),
              { name: "HMAC", hash: "SHA-256" },
              false,
              ["sign"]
            );
            const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
            const expectedSig = `sha256=${Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;

            if (signature !== expectedSig && request.headers.get("x-secret") !== secret) {
              return new Response(JSON.stringify({ error: "Invalid signature" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              });
            }
          } else if (!signature && !request.headers.get("x-secret")) {
            // No HMAC and no x-secret — require Bearer auth
            const authHeader = request.headers.get("authorization");
            const cronSecret = settings?.sync_secret || process.env["CRON_SECRET"];
            if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
              return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          // 3. Process the stock change event
          const event = (payload.event as string) || "stock_changed";
          const productId = payload.product_id as string;
          const productName = payload.name as string;
          const stock = payload.stock as number;
          const previousStock = payload.previous_stock as number;
          const price = payload.price as string;
          const category = payload.category as string;
          const brand = payload.brand as string;
          const variants = payload.variants as Array<Record<string, unknown>> | undefined;

          if (!productName && !productId) {
            return new Response(JSON.stringify({ error: "Missing product name or ID" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 4. Log the webhook event
          await supabaseAdmin.from("webhook_logs").insert({
            direction: "inbound",
            target_url: "stock-change",
            event_type: event,
            payload: payload,
            processing_status: "completed",
            response_status: 200,
          });

          // 5. Update training pairs based on stock change
          const name = productName || `Product ${productId}`;
          const stockStatus = stock === 0 || stock === "out_of_stock" ? "স্টকে নেই" : "স্টকে আছে";
          const stockStatusEn = stock === 0 || stock === "out_of_stock" ? "out of stock" : "in stock";

          const trainingUpdates: Array<{
            question: string;
            answer: string;
            status: "approved";
            source: string;
          }> = [];

          // Stock availability Q&A
          trainingUpdates.push({
            question: `${name} স্টকে আছে কি?`,
            answer: `${name} এর স্টক: ${stockStatus}।${stock > 0 ? ` ${stock}টি স্টকে আছে।` : ""}`,
            status: "approved",
            source: "stock_webhook",
          });

          trainingUpdates.push({
            question: `Is ${name} in stock?`,
            answer: `${name} is ${stockStatusEn}.${stock > 0 ? ` ${stock} units available.` : ""}`,
            status: "approved",
            source: "stock_webhook",
          });

          // Price Q&A (if price changed)
          if (price) {
            trainingUpdates.push({
              question: `${name} এর দাম কত?`,
              answer: `${name} এর দাম ${price} টাকা।${category ? ` ক্যাটাগরি: ${category}।` : ""}${brand ? ` ব্র্যান্ড: ${brand}।` : ""}`,
              status: "approved",
              source: "stock_webhook",
            });
          }

          // Stock change notification Q&A (if stock went to 0)
          if (previousStock && stock === 0 && previousStock > 0) {
            trainingUpdates.push({
              question: `${name} কি শেষ হয়ে গেছে?`,
              answer: `হ্যাঁ, ${name} এখন স্টকে নেই। আমরা শীঘ্রই স্টকে ফিরিয়ে আনব।`,
              status: "approved",
              source: "stock_webhook",
            });
          }

          // Stock restocked notification
          if (previousStock === 0 && stock > 0) {
            trainingUpdates.push({
              question: `${name} কি আবার স্টকে এসেছে?`,
              answer: `হ্যাঁ! ${name} আবার স্টকে এসেছে। ${stock}টি স্টকে আছে। এখনই অর্ডার করুন!`,
              status: "approved",
              source: "stock_webhook",
            });
          }

          // Variant-specific stock updates
          if (variants && variants.length > 0) {
            for (const variant of variants.slice(0, 10)) {
              const variantName = (variant.name as string) || (variant.size as string) || (variant.color as string);
              const variantStock = variant.stock as number;
              if (variantName) {
                trainingUpdates.push({
                  question: `${name} ${variantName} স্টকে আছে কি?`,
                  answer: `${name} (${variantName}) ${variantStock === 0 ? "স্টকে নেই" : `${variantStock}টি স্টকে আছে`}।`,
                  status: "approved",
                  source: "stock_webhook",
                });
              }
            }
          }

          // Upsert training pairs (conflict on question = update)
          if (trainingUpdates.length > 0) {
            await supabaseAdmin
              .from("training_pairs")
              .upsert(trainingUpdates, { onConflict: "question" });
          }

          // 6. Audit log
          await supabaseAdmin
            .from("audit_logs")
            .insert({
              actor_id: "system",
              action: "stock_webhook_received",
              entity_type: "training_pairs",
              metadata: {
                event,
                product_name: name,
                product_id: productId,
                stock,
                previous_stock: previousStock,
                training_pairs_updated: trainingUpdates.length,
                duration_ms: Date.now() - startTime,
              },
            })
            .catch(console.error);

          return new Response(
            JSON.stringify({
              success: true,
              event,
              product: name,
              stock,
              training_pairs_updated: trainingUpdates.length,
              duration_ms: Date.now() - startTime,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error: any) {
          console.error("[Stock Webhook] Error:", error);

          // Log failed webhook
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("webhook_logs").insert({
              direction: "inbound",
              target_url: "stock-change",
              event_type: "error",
              payload: { error: error.message },
              processing_status: "failed",
              response_status: 500,
            });
          } catch (e) {
            // Ignore logging errors
          }

          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },

      // Health check / verification endpoint
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "ok",
            endpoint: "stock-change-webhook",
            description: "Receives stock change notifications from Wear Impressive ERP",
            expected_headers: {
              "X-AI-Signature": "sha256=<hmac-signature>",
              "X-Secret": "<sync_secret>",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
