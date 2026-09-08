/**
 * Auto-training cron endpoint
 * Called by cron every hour: curl -H "X-Cron-Secret: $CRON_SECRET" https://daddyai.online/api/public/cron/auto-train
 * Loops until confidence >= threshold or maxRounds reached
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/auto-train")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace("Bearer ", "");
        const expectedSecret = process.env["CRON_SECRET"];

        if (expectedSecret && secret !== expectedSecret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runAutoTraining } = await import("@/lib/auto-training.server");

        try {
          const { data: settings } = await supabaseAdmin
            .from("agent_settings")
            .select("auto_train_enabled, training_confidence_threshold, training_confidence_score")
            .eq("id", 1).maybeSingle();

          if (!settings?.auto_train_enabled) {
            return new Response(JSON.stringify({ skipped: true, reason: "auto_train_enabled is false" }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          const threshold = settings?.training_confidence_threshold ?? 0.85;
          let currentScore = settings?.training_confidence_score ?? 0;
          const maxRounds = 10;
          const results = [];
          // Overall deadline: stop the whole cron loop well before it can wedge.
          // Each round already has its own 30s internal deadline; cap the outer
          // loop at ~60s total so the hourly cron always returns promptly.
          const overallDeadline = Date.now() + 300_000; // 5 min — enough for 10 rounds

          // Loop until confident or maxRounds/overall deadline hit
          for (let round = 0; round < maxRounds; round++) {
            if (currentScore >= threshold) break;
            if (Date.now() > overallDeadline) {
              console.log(`[AutoTrain] overall deadline reached after round ${round} — bailing to keep cron responsive`);
              break;
            }

            console.log(`[AutoTrain] Round ${round + 1}, confidence: ${currentScore} < ${threshold}`);
            const result = await runAutoTraining(100);
            results.push({ round: round + 1, ...result });
            currentScore = result.confidence_score;

            if (!result.needs_more_training) break;
            // Small delay between rounds
            await new Promise(r => setTimeout(r, 1000));
          }

          return new Response(JSON.stringify({
            ok: true,
            rounds: results.length,
            final_confidence: currentScore,
            reached_threshold: currentScore >= threshold,
            results,
          }), { headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          console.error("[AutoTrain cron] failed:", err);
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
      GET: async ({ request }) => {
        // Allow GET for easy manual trigger from browser/curl
        return new Response(JSON.stringify({ message: "POST to this endpoint to trigger auto-training" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
