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
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let logId: string | null = null;
        let requestPayload: any = null;

        try {
          const apiKey = request.headers.get("x-api-key") || request.headers.get("Authorization")?.replace("Bearer ", "");
          const signature = request.headers.get("x-webhook-signature") || request.headers.get("x-ai-signature");
          const idempotencyKey = request.headers.get("x-idempotency-key");

          const { hashApiKey, verifyWebhookSignature } = await import("@/lib/admin.server");

          const rawBody = await request.text();
          try { requestPayload = JSON.parse(rawBody); } catch {}
          
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
              payload: requestPayload || { raw: rawBody },
              headers: Object.fromEntries(request.headers.entries()),
              status_code: 401,
              processing_status: 'failed',
              error_details: 'Unauthorized'
            });
            return json({ error: "Unauthorized" }, 401);
          }

          // Log start of authorized request
          const { data: logRow } = await supabaseAdmin.from("webhook_logs").insert({
            source: 'custom',
            event_type: requestPayload?.event || 'message',
            payload: requestPayload,
            headers: Object.fromEntries(request.headers.entries()),
            status_code: 200,
            processing_status: 'pending'
          }).select('id').single();
          
          logId = logRow?.id || null;

          const parsed = WebhookSchema.safeParse(requestPayload);
          if (!parsed.success) {
            if (logId) {
              await supabaseAdmin.from("webhook_logs").update({
                processing_status: 'failed',
                status_code: 400,
                error_details: JSON.stringify(parsed.error.format())
              }).eq('id', logId);
            }
            return json({ error: "Invalid webhook payload", details: parsed.error.format() }, 400);
          }

          const finalIdempotencyKey = idempotencyKey || parsed.data.idempotency_key;

          if (finalIdempotencyKey) {
            const { data: existing } = await supabaseAdmin
              .from("webhook_logs")
              .select("id, status_code, payload")
              .eq("headers->>x-idempotency-key", finalIdempotencyKey)
              .eq("status_code", 200)
              .neq('id', logId)
              .maybeSingle();

            if (existing) {
               if (logId) await supabaseAdmin.from("webhook_logs").delete().eq('id', logId);
               return json({ status: "idempotent", message: "Request already processed" });
            }
          }

          const { generateReply, logConversation } = await import("@/lib/agent.server");

          // 3. Handle Training Ingestion
          if (parsed.data.training_data) {
            const { question, answer, context: trainingContext } = parsed.data.training_data;
            
            // Idempotency: Don't insert duplicate questions in a short period
            const { data: existingPair } = await supabaseAdmin
              .from("training_pairs")
              .select("id")
              .eq("question", question)
              .limit(1)
              .maybeSingle();

            if (!existingPair) {
              const { error: insertError } = await supabaseAdmin.from("training_pairs").insert({
                question,
                answer,
                source: 'webhook',
                status: 'pending',
                metadata: { context: trainingContext, webhook_payload: requestPayload } as any
              } as any);

              if (insertError) throw insertError;

              const { data: runningJobs } = await supabaseAdmin
                .from("training_jobs")
                .select("id")
                .eq("status", "running")
                .limit(1);

              if (!runningJobs || runningJobs.length === 0) {
                await supabaseAdmin.from("training_jobs").insert({
                  status: "running",
                  processed_count: 0,
                  retry_count: 0
                } as any);
              }
            }
            
            if (logId) {
              await supabaseAdmin.from("webhook_logs").update({
                processing_status: 'success'
              }).eq('id', logId);
            }
            return json({ success: true, message: "Training data received" });
          }

          // Handle generic message events
          if (parsed.data.message) {
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

            if (logId) {
              await supabaseAdmin.from("webhook_logs").update({
                processing_status: 'success'
              }).eq('id', logId);
            }
            return json({ status: "processed", reply });
          }

          if (logId) {
            await supabaseAdmin.from("webhook_logs").update({
              processing_status: 'success'
            }).eq('id', logId);
          }
          return json({ status: "received" });

        } catch (error: any) {
          console.error("Webhook processing error:", error);
          if (logId) {
            const backoffMinutes = [1, 5, 30, 120, 720];
            const nextRetryMinutes = backoffMinutes[0]; 
            const nextRetryAt = new Date();
            nextRetryAt.setMinutes(nextRetryAt.getMinutes() + nextRetryMinutes);

            await supabaseAdmin.from("webhook_logs").update({
              processing_status: 'pending',
              retry_count: 0,
              next_retry_at: nextRetryAt.toISOString(),
              error_details: error.message
            }).eq('id', logId);
          }
          return json({ error: "Internal processing error, scheduled for retry" }, 500);
        }
      },
    },
  },
});

export async function processWebhookRetry(logId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: log } = await supabaseAdmin.from("webhook_logs").select("*").eq("id", logId).single();
  
  if (!log || log.processing_status !== 'pending') return;

  const { generateReply, logConversation } = await import("@/lib/agent.server");
  const body = log.payload as any;

  try {
    if (body.training_data) {
      const { question, answer, context: trainingContext } = body.training_data;
      const { data: existingPair } = await supabaseAdmin.from("training_pairs").select("id").eq("question", question).maybeSingle();
      if (!existingPair) {
        await supabaseAdmin.from("training_pairs").insert({
          question, answer, source: 'webhook', status: 'pending',
          metadata: { context: trainingContext, webhook_payload: body } as any
        } as any);
      }
    } else if (body.message) {
      const { reply } = await generateReply(body.message, []);
      await logConversation(body.conversation_id || body.sender || null, "webhook", [
        { role: "user", content: body.message },
        { role: "assistant", content: reply }
      ]);
    }

    await supabaseAdmin.from("webhook_logs").update({
      processing_status: 'success',
      error_details: null
    }).eq('id', logId);

  } catch (error: any) {
    const retryCount = (log.retry_count || 0) + 1;
    const backoffMinutes = [1, 5, 30, 120, 720];
    
    if (retryCount >= backoffMinutes.length) {
      await supabaseAdmin.from("webhook_logs").update({
        processing_status: 'dead_letter',
        retry_count: retryCount,
        error_details: `Max retries exhausted: ${error.message}`
      }).eq('id', logId);
    } else {
      const nextRetryAt = new Date();
      nextRetryAt.setMinutes(nextRetryAt.getMinutes() + backoffMinutes[retryCount]);
      await supabaseAdmin.from("webhook_logs").update({
        processing_status: 'pending',
        retry_count: retryCount,
        next_retry_at: nextRetryAt.toISOString(),
        error_details: error.message
      }).eq('id', logId);
    }
  }
}