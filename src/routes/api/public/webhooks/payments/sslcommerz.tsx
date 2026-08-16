import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/payments/sslcommerz")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("X-Webhook-Secret") || new URL(request.url).searchParams.get("secret");
        const expectedSecret = process.env['PAYMENTS_WEBHOOK_SECRET'];
        
        if (expectedSecret && secret !== expectedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }
        
        const body = await request.formData();
        console.log("SSLCommerz IPN received:", Object.fromEntries(body.entries()));
        
        return new Response("OK", { status: 200 });
      }
    }
  }
});
