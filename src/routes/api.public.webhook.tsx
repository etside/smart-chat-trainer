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
    question: z.string().min(1),
    answer: z.string().min(1),
    context: z.string().optional(),
  }).optional(),
  // Multi-role/Tenant context
  tenant_id: z.string().uuid().optional(),
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
          const timestamp = request.headers.get("x-webhook-timestamp");

          const { hashApiKey, verifyWebhookSignature } = await import("@/lib/admin.server");

          const rawBody = await request.text();
          try { requestPayload = JSON.parse(rawBody); } catch {}
          
          const { data: settings } = await supabaseAdmin.from("agent_settings").select("webhook_secret, sync_secret").eq("id", 1).maybeSingle();
          const secret = (settings as any)?.webhook_secret || process.env['WEBHOOK_SECRET'] || (settings as any)?.sync_secret || process.env['SYNC_SECRET'];


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
            // Replay protection: Verify signature includes timestamp if provided
            const bodyToVerify = timestamp ? `${timestamp}.${rawBody}` : rawBody;
            isAuthorized = await verifyWebhookSignature(bodyToVerify, signature, secret);
            
            // Replay protection: Reject if timestamp is too old (5 mins)
            if (isAuthorized && timestamp) {
              const ts = parseInt(timestamp, 10);
              const now = Math.floor(Date.now() / 1000);
              if (isNaN(ts) || Math.abs(now - ts) > 300) {
                isAuthorized = false;
                console.warn("Webhook timestamp validation failed.");
              }
            }
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
              error_details: 'Unauthorized or invalid signature'
            });
            return json({ error: "Unauthorized" }, 401);
          }

          // Log start of authorized request
          // NOTE: do not chain .select() after .insert() — the pg-client shim
          // would reset the mode and turn this into a plain SELECT.
          const { data: logRows } = await supabaseAdmin.from("webhook_logs").insert({
            source: 'custom',
            event_type: requestPayload?.event || 'message',
            payload: requestPayload,
            headers: Object.fromEntries(request.headers.entries()),
            status_code: 200,
            processing_status: 'pending'
          });
          logId = (logRows as any)?.[0]?.id || null;

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

          if (finalIdempotencyKey && logId) {
            const { data: existing } = await supabaseAdmin
              .from("webhook_logs")
              .select("id, status_code, payload")
              .eq("headers->>x-idempotency-key", finalIdempotencyKey)
              .eq("status_code", 200)
              .neq('id', logId)
              .maybeSingle();

            if (existing) {
               await supabaseAdmin.from("webhook_logs").delete().eq('id', logId);
               return json({ status: "idempotent", message: "Request already processed" });
            }
          }

          const { generateReply, logConversation } = await import("@/lib/agent.server");

          // Check auto-reply mode (direct DB read — getExtraSettingsAdmin is auth-gated and
          // cannot be called from a webhook context without a user session)
          const { data: settingsRow } = await supabaseAdmin
            .from("agent_settings")
            .select("auto_reply_mode")
            .eq("id", 1)
            .maybeSingle();
          const autoReplyMode = (settingsRow as any)?.auto_reply_mode || 'off';

          // OFF mode: generate reply but store as draft (don't send)
          // ON mode: generate and send immediately
          // Standby: same as OFF (draft for approval)

          // For generic messages, ensure we use current catalog info for stock/inventory info
          // by passing the secret and token in headers if available for the inner sync logic
          // Note: syncCatalog logic is now automatically triggered inside generateReply for product queries.


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
            // Use sales pipeline for sentiment, lead scoring, and smart escalation
            let reply: string | null = null;
            let pipelineResult: any = null;
            try {
              const { processSalesMessage } = await import("@/lib/sales-agent.server");
              pipelineResult = await processSalesMessage({
                message: parsed.data.message,
                conversationId: null,
                sessionId: null,
                externalId: parsed.data.sender || parsed.data.conversation_id || null,
                channel: "webhook",
                history: [],
                generateReplyFn: async (msg, hist) => {
                  const generated = await generateReply(msg, hist);
                  return { reply: generated.reply, examples: [] };
                },
              });
              reply = pipelineResult.reply;
            } catch (aiError: any) {
              console.error("Sales pipeline failed (conversation will still be logged):", aiError?.message || aiError);
              // Fallback to direct generateReply
              try {
                const generated = await generateReply(parsed.data.message, []);
                reply = generated.reply;
              } catch (fallbackError: any) {
                console.error("generateReply also failed:", fallbackError?.message || fallbackError);
              }
            }

            // Log conversation to inbox (both ON and OFF modes, and even when AI failed)
            await logConversation(
              parsed.data.conversation_id || parsed.data.sender || null,
              "webhook",
              reply
                ? [
                    { role: "user", content: parsed.data.message },
                    { role: "assistant", content: reply }
                  ]
                : [{ role: "user", content: parsed.data.message }]
            );

            // AI failed: record failure and stop (nothing to send or approve)
            if (!reply) {
              if (logId) {
                await supabaseAdmin.from("webhook_logs").update({
                  processing_status: 'failed',
                  error_details: 'AI reply generation failed (check AI provider credits/config)'
                }).eq('id', logId);
              }
              return json({ status: "logged_without_reply", error: "AI unavailable" }, 200);
            }

            // OFF or Standby: generate reply but store as draft (don't send)
            if (autoReplyMode === 'off' || autoReplyMode === 'standby') {
              if (logId) {
                await supabaseAdmin.from("webhook_logs").update({
                  processing_status: 'pending_approval',
                  payload: { ...requestPayload, draft_reply: reply },
                }).eq('id', logId);
              }
              console.log(`[auto-reply] Mode is ${autoReplyMode.toUpperCase()} — draft stored`);
              return json({ status: "draft_stored", draft_reply: reply });
            }

            // ON mode: send reply immediately
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
            const nextRetryMinutes = backoffMinutes[0] || 1; 
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
      const nextRetryMinutes = backoffMinutes[retryCount] || 60;
      const nextRetryAt = new Date();
      nextRetryAt.setMinutes(nextRetryAt.getMinutes() + nextRetryMinutes);
      await supabaseAdmin.from("webhook_logs").update({
        processing_status: 'pending',
        retry_count: retryCount,
        next_retry_at: nextRetryAt.toISOString(),
        error_details: error.message
      }).eq('id', logId);
    }
  }
}