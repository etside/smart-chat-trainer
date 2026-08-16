import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/payments/bkash")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        console.log("bKash Callback received:", body);
        
        // bKash doesn't support custom headers easily, so we rely on payload verification
        // In a real scenario, you'd verify the paymentID with bKash API here.
        
        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
