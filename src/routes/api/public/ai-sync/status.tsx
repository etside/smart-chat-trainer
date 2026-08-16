import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ai-sync/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        
        const token = authHeader.substring(7);
        const { hashApiKey } = await import("@/lib/admin.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        
        const { data: keyRow } = await supabaseAdmin
          .from("api_keys")
          .select("id, revoked")
          .eq("key_hash", await hashApiKey(token))
          .maybeSingle();
          
        if (!keyRow || keyRow.revoked) {
          return new Response("Unauthorized", { status: 401 });
        }
        
        return new Response(JSON.stringify({ 
          status: "operational",
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
