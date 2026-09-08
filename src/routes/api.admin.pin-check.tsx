import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/pin-check")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("agent_settings")
            .select("admin_pin, pin_enabled")
            .eq("id", 1)
            .maybeSingle();

          if (data?.pin_enabled === false) {
            return new Response(JSON.stringify({ pin: null, enabled: false }), {
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ pin: data?.admin_pin ?? "856777", enabled: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ pin: "856777", enabled: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
