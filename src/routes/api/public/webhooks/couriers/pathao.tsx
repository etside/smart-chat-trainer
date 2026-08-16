import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/couriers/pathao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("X-Webhook-Token") || new URL(request.url).searchParams.get("token");
        const secret = process.env['PATHAO_WEBHOOK_SECRET'];
        
        if (!secret) {
          console.error("PATHAO_WEBHOOK_SECRET is not configured.");
          return new Response("Configuration Error", { status: 500 });
        }

        if (token !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        
        const body = await request.json();
        console.log("Pathao Webhook received:", body);
        
        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
