import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/payments/nagad")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        console.log("Nagad Callback received:", body);
        
        // Nagad verification logic here
        
        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
