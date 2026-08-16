import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/couriers/redx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("X-Webhook-Token") || new URL(request.url).searchParams.get("token");
        const secret = process.env['REDX_WEBHOOK_SECRET'];
        
        if (secret && token !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        
        const body = await request.json();
        console.log("RedX Webhook received:", body);
        
        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
