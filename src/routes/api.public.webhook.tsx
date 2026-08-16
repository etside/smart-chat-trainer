import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const WebhookSchema = z.object({
  event: z.string().optional(),
  message: z.string().optional(),
  sender: z.string().optional(),
  conversation_id: z.string().optional(),
  idempotency_key: z.string().optional(),
  payload: z.any().optional(),
  // For training pipeline ingestion
  training_data: z.object({
    question: z.string(),
    answer: z.string(),
    context: z.string().optional(),
  }).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key, x-webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key") || request.headers.get("Authorization")?.replace("Bearer ", "");
        const signature = request.headers.get("x-webhook-signature") || request.headers.get("x-ai-signature");
        const idempotencyKey = request.headers.get("x-idempotency-key");

        const { hashApiKey, verifyWebhookSignature } = await import("@/lib/admin.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rawBody = await request.text();
        const { data: settings } = await supabaseAdmin.from("agent_settings").select("sync_secret").eq("id", 1).maybeSingle();
        const secret = settings?.sync_secret || process.env['SYNC_SECRET'];

        let isAuthorized = false;

        // 1. Check API Key
        if (apiKey) {
          const { data: keyRow } = await supabaseAdmin
            .from("api_keys")
            .select("id, revoked")
            .eq("key_hash", await hashApiKey(apiKey))
            .maybeSingle();
          if (keyRow && !keyRow.revoked) isAuthorized = true;
        }

        // 2. Check HMAC Signature (if API key fails)
        if (!isAuthorized && signature && secret) {
          isAuthorized = await verifyWebhookSignature(rawBody, signature, secret);
        }

        if (!isAuthorized) {
          console.warn("Unauthorized webhook attempt blocked.");
          await supabaseAdmin.from("webhook_logs").insert({
            source: 'custom',
            event_type: 'unauthorized',
            payload: { error: 'Invalid API Key or Signature' },
            headers: Object.fromEntries(request.headers.entries()),
            status_code: 401
          });
          return json({ error: "Unauthorized" }, 401);
        }

        let body;
        try {
          body = JSON.parse(rawBody);
        } catch {
          await supabaseAdmin.from("webhook_logs").insert({
            source: 'custom',
            event_type: 'invalid_json',
            payload: { error: 'Invalid JSON body' },
            headers: Object.fromEntries(request.headers.entries()),
            status_code: 400
          });
          return json({ error: "Invalid JSON body" }, 400);
        }

        // Log successful authorized request
        await supabaseAdmin.from("webhook_logs").insert({
          source: 'custom',
          event_type: body.event || 'message',
          payload: body,
          headers: Object.fromEntries(request.headers.entries()),
          status_code: 200
        });


        const parsed = WebhookSchema.safeParse(body);
        if (!parsed.success) {
          await supabaseAdmin.from("webhook_logs").insert({
            source: 'custom',
            event_type: 'validation_error',
            payload: { error: parsed.error.format(), body },
            headers: Object.fromEntries(request.headers.entries()),
            status_code: 400
          });
          return json({ error: "Invalid webhook payload", details: parsed.error.format() }, 400);
        }

        const finalIdempotencyKey = idempotencyKey || parsed.data.idempotency_key;

        if (finalIdempotencyKey) {
          const { data: existing } = await supabaseAdmin
            .from("webhook_logs")
            .select("id, status_code, payload")
            .eq("headers->>x-idempotency-key", finalIdempotencyKey)
            .eq("status_code", 200)
            .maybeSingle();

          if (existing) {
             return json({ status: "idempotent", message: "Request already processed" });
          }
        }

        const { generateReply, logConversation } = await import("@/lib/agent.server");

        // Handle generic message events
        if (parsed.data.message) {
          try {
            const { reply } = await generateReply(parsed.data.message, []);
            
            // Log activity to first valid API key for tracking if possible
            const { data: firstKey } = await supabaseAdmin
              .from("api_keys")
              .select("id")
              .eq("revoked", false)
              .limit(1)
              .maybeSingle();

            if (firstKey) {
              await supabaseAdmin
                .from("api_keys")
                .update({ last_used_at: new Date().toISOString() })
                .eq("id", firstKey.id);
            }


            await logConversation(
              parsed.data.conversation_id || parsed.data.sender || null,

              "webhook",
              [
                { role: "user", content: parsed.data.message },
                { role: "assistant", content: reply }
              ]
            );

            // In a webhook context, we often return the reply directly for synchronous handling
            // or queue it for asynchronous delivery if the external platform requires a callback.
            return json({ status: "processed", reply });
          } catch (error) {
            console.error("Webhook processing error:", error);
            return json({ error: "Failed to process message" }, 500);
          }
        }

        // Handle training pipeline ingestion
        if (parsed.data.training_data) {
          try {
            const { question, answer, context: trainingContext } = parsed.data.training_data;
            const { error } = await supabaseAdmin.from("training_pairs").upsert(
              {
                question,
                answer,
                context: trainingContext || null,
                source: "webhook_ingest",
                status: "approved",
              },
              { onConflict: "question" }
            );

            if (error) throw error;

            // Trigger training job automatically
            const { triggerTraining } = await import("@/lib/console.functions");
            await triggerTraining({ data: { source: "webhook_ingest" } as any });

            return json({ status: "ingested", message: "Training data added to pipeline" });
          } catch (error) {
            console.error("Training ingestion error:", error);
            return json({ error: "Failed to ingest training data" }, 500);
          }
        }

        return json({ status: "received" });
      },
    },
  },
});
