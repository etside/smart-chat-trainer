import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.string().max(120).optional(),
  channel: z.string().max(40).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .optional(),
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
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return json({ error: "Invalid request body" }, 400);
        }

        const { generateReply, logConversation } = await import("@/lib/agent.server");

        try {
          const { reply } = await generateReply(parsed.message, parsed.history ?? [], keyRow.version_id);

          await supabaseAdmin
            .from("api_keys")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", keyRow.id);

          await logConversation(parsed.conversation_id ?? null, parsed.channel ?? "api", [
            ...(parsed.history ?? []),
            { role: "user" as const, content: parsed.message },
            { role: "assistant" as const, content: reply },
          ]);

          return json({ reply });
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
