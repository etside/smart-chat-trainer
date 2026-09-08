import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.string().max(120).optional(),
  channel: z.string().max(40).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(20).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key");
        if (!apiKey) return json({ error: "Missing x-api-key header" }, 401);

        const { hashApiKey } = await import("@/lib/admin.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: keyRow } = await supabaseAdmin
          .from("api_keys")
          .select("id, revoked, version_id")
          .eq("key_hash", await hashApiKey(apiKey))
          .maybeSingle();

        if (!keyRow || keyRow.revoked) return json({ error: "Invalid API key" }, 401);

        let parsed;
        try { parsed = BodySchema.parse(await request.json()); }
        catch { return json({ error: "Invalid request body" }, 400); }

        const { generateReply, logConversation } = await import("@/lib/agent.server");

        try {
          const { data: settings } = await supabaseAdmin
            .from("agent_settings").select("sentiment_enabled").eq("id", 1).maybeSingle();

          let reply: string;
          let salesMetadata: Record<string, unknown> | undefined;
          let product_cards: any[] | undefined;

          if (settings?.sentiment_enabled) {
            const { processSalesMessage } = await import("@/lib/sales-agent.server");

            const result = await processSalesMessage({
              message: parsed.message,
              conversationId: parsed.conversation_id ?? null,
              sessionId: null,
              externalId: parsed.conversation_id ?? null,
              channel: parsed.channel ?? "api",
              history: parsed.history ?? [],
              generateReplyFn: async (msg, hist) => {
                const res = await generateReply(msg, hist);
                // Capture product_cards from sales pipeline too
                if (res.product_cards) product_cards = res.product_cards;
                return res;
              },
            });

            reply = result.reply;
            if (!product_cards) {
              // Also try direct product search for non-sales path
              const { searchProductCards } = await import("@/lib/agent.server");
              const { PRODUCT_QUERY_PATTERN } = await import("@/lib/agent.server").catch(() => ({ PRODUCT_QUERY_PATTERN: null })) as any;
              try {
                const term = parsed.message.replace(/[?।!]/g, "").trim().slice(0, 60);
                const cards = await searchProductCards(term, 3);
                if (cards.length > 0) product_cards = cards;
              } catch {}
            }
            salesMetadata = {
              sentiment: result.sentiment,
              lead_score: result.leadScore.score,
              lead_tier: result.leadScore.tier,
              escalated: result.escalated,
              signals: result.leadScore.signals,
            };
          } else {
            const res = await generateReply(parsed.message, parsed.history ?? [], keyRow.version_id);
            reply = res.reply;
            product_cards = res.product_cards;
          }

          await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

          await logConversation(parsed.conversation_id ?? null, parsed.channel ?? "api", [
            ...(parsed.history ?? []),
            { role: "user" as const, content: parsed.message },
            { role: "assistant" as const, content: reply },
          ]);

          const responseBody: Record<string, unknown> = { reply };
          if (salesMetadata) {
            responseBody.sentiment = salesMetadata.sentiment;
            responseBody.lead_score = salesMetadata.lead_score;
            responseBody.lead_tier = salesMetadata.lead_tier;
            responseBody.escalated = salesMetadata.escalated;
            responseBody.signals = salesMetadata.signals;
          }
          // Always include product_cards if found — frontend/WhatsApp renders them
          if (product_cards && product_cards.length > 0) {
            responseBody.product_cards = product_cards.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              currency: p.currency || "BDT",
              image_url: p.image_url,
              product_url: p.product_url,
              availability: p.availability,
              stock: p.stock,
              category: p.category,
              brand: p.brand,
              short_description: p.short_description,
              sizes: p.sizes || [],
              variants_count: Array.isArray(p.variants) ? p.variants.length : 0,
            }));
          }

          return json(responseBody);
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          if (message === "RATE_LIMIT") return json({ error: "Rate limit exceeded" }, 429);
          if (message === "NO_CREDITS") return json({ error: "AI credits exhausted" }, 402);
          console.error("public chat error", error);
          return json({ error: "Failed to generate reply" }, 500);
        }
      },
    },
  },
});
