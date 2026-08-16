import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const WebhookSchema = z.object({
  // Generic webhook schema that can be adapted
  event: z.string().optional(),
  message: z.string().optional(),
  sender: z.string().optional(),
  conversation_id: z.string().optional(),
  payload: z.any().optional(),
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
        const apiKey = request.headers.get("x-api-key");
        const signature = request.headers.get("x-webhook-signature");

        const { hashApiKey, verifyWebhookSignature } = await import("@/lib/admin.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rawBody = await request.text();
        const secret = process.env['SYNC_SECRET'];

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
          return json({ error: "Unauthorized" }, 401);
        }

        let body;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const parsed = WebhookSchema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid webhook payload" }, 400);

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

        return json({ status: "received" });
      },
    },
  },
});
