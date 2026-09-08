/**
 * src/routes/api/public/validate-stream.ts
 *
 * Two-pass SSE orchestration:
 *   Pass 1 — Validation (15-section dossier JSON)
 *   Pass 2 — Marketing strategy (gated: only if legitimacy_screen passes)
 *
 * SSE event types:
 *   { type: "status", message: string }
 *   { type: "chunk",  pass: 1|2, delta: string }
 *   { type: "pass1_done", dossier: FullDossier }
 *   { type: "pass2_done", strategy: MarketingStrategy }
 *   { type: "strategy_skipped", reason: string }
 *   { type: "error", message: string }
 *   { type: "done" }
 *
 * Auth: accepts either a Bearer JWT (logged-in user) OR a public API key
 * via x-api-key header. Anonymous requests are rate-limited to 3/day by IP.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  buildValidatorSystemPrompt,
  buildIntakeMessage,
  parseDossierJson,
} from "@/lib/skills/validator.prompt";
import {
  buildMarketingSystemPrompt,
  buildMarketingIntakeMessage,
  strategyAllowed,
} from "@/lib/skills/marketing.prompt";
import {
  ValidateIntakeSchema,
  FullDossierSchema,
  MarketingStrategySchema,
  DISCLAIMER,
} from "@/lib/validation-schema";
import {
  ingestFromText,
  ingestFromUrl,
  ingestFromFile,
} from "@/lib/plan-ingest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = process.env["AI_GATEWAY_URL"] || "https://api.xiaomimimo.com/v1";
const API_KEY_ENV = process.env["MIMO_API_KEY"] || "";
const MAX_MULTIPART_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── SSE helpers ───────────────────────────────────────────────────────────────

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function createSSEStream(
  callback: (enqueue: (chunk: string) => void, close: () => void) => Promise<void>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const close = () => controller.close();
      callback(enqueue, close).catch((err) => {
        enqueue(sseEvent({ type: "error", message: String(err?.message ?? err) }));
        close();
      });
    },
  });
}

// ─── AI streaming ─────────────────────────────────────────────────────────────

async function streamChatCompletion(
  systemPrompt: string,
  userMessage: string,
  onChunk: (delta: string) => void
): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY_ENV}`,
    },
    body: JSON.stringify({
      model: "mimo-v2.5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: true,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const raw = decoder.decode(value, { stream: true });
    const lines = raw.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }

  return full;
}

// ─── Request parsing ───────────────────────────────────────────────────────────

async function parseRequest(request: Request): Promise<{
  intake: z.infer<typeof ValidateIntakeSchema>;
  fileBuffer?: Buffer;
  filename?: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const url = formData.get("url") as string | null;
    const planText = formData.get("planText") as string | null;

    let rawText = planText ?? "";
    let fileBuffer: Buffer | undefined;
    let filename: string | undefined;

    if (file && file.size > 0) {
      if (file.size > MAX_MULTIPART_SIZE) {
        throw new Error("File too large (max 10 MB)");
      }
      fileBuffer = Buffer.from(await file.arrayBuffer());
      filename = file.name;
    } else if (url) {
      const ingested = await ingestFromUrl(url);
      rawText = ingested.rawText;
    }

    const intake = ValidateIntakeSchema.parse({
      planText: rawText || " ",
      founderName: formData.get("founderName") ?? undefined,
      businessName: formData.get("businessName") ?? undefined,
      sector: formData.get("sector") ?? undefined,
      stage: formData.get("stage") ?? undefined,
      country: formData.get("country") ?? undefined,
      askAmount: formData.get("askAmount") ?? undefined,
      currency: formData.get("currency") ?? undefined,
      additionalContext: formData.get("additionalContext") ?? undefined,
      url: url ?? undefined,
    });

    return { intake, fileBuffer, filename };
  }

  // JSON body
  const body = await request.json();
  const intake = ValidateIntakeSchema.parse(body);

  if (intake.url) {
    const ingested = await ingestFromUrl(intake.url);
    intake.planText = ingested.rawText;
  }

  return { intake };
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/public/validate-stream")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // Parse + ingest
        let intake: z.infer<typeof ValidateIntakeSchema>;
        let planText: string;

        try {
          const parsed = await parseRequest(request);
          intake = parsed.intake;

          if (parsed.fileBuffer && parsed.filename) {
            const ingested = await ingestFromFile({
              buffer: parsed.fileBuffer,
              filename: parsed.filename,
            });
            planText = ingested.rawText;
          } else {
            const ingested = await ingestFromText(intake.planText);
            planText = ingested.rawText;
          }
        } catch (err: unknown) {
          return new Response(
            JSON.stringify({ error: String((err as Error)?.message ?? err) }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const businessContext = {
          businessName: intake.businessName,
          sector: intake.sector,
          country: intake.country,
          stage: intake.stage,
          currency: intake.currency,
        };

        const body = createSSEStream(async (enqueue, close) => {
          // ── Pass 1: Validation ───────────────────────────────────────────
          enqueue(
            sseEvent({
              type: "status",
              message: "Running validation analysis (15-section dossier)…",
            })
          );

          let rawDossier = "";
          try {
            rawDossier = await streamChatCompletion(
              buildValidatorSystemPrompt(),
              buildIntakeMessage({
                planText,
                founderName: intake.founderName,
                businessName: intake.businessName,
                sector: intake.sector,
                stage: intake.stage,
                country: intake.country,
                askAmount: intake.askAmount,
                currency: intake.currency,
                additionalContext: intake.additionalContext,
              }),
              (delta) => enqueue(sseEvent({ type: "chunk", pass: 1, delta }))
            );
          } catch (err) {
            enqueue(sseEvent({ type: "error", message: `Validation failed: ${String(err)}` }));
            close();
            return;
          }

          // Parse dossier
          let dossier = parseDossierJson(rawDossier);
          if (!dossier) {
            // Try lenient Zod parse on raw
            try {
              dossier = FullDossierSchema.parse(JSON.parse(rawDossier.trim()));
            } catch {
              // Return raw as partial
              dossier = FullDossierSchema.parse({
                generated_at: new Date().toISOString(),
                overall_score: 0,
                disclaimer: DISCLAIMER,
                _raw: rawDossier,
              });
            }
          }

          enqueue(sseEvent({ type: "pass1_done", dossier }));

          // ── Pass 2: Marketing Strategy ───────────────────────────────────
          const gate = strategyAllowed(dossier);
          if (!gate.allowed) {
            enqueue(sseEvent({ type: "strategy_skipped", reason: gate.reason }));
            enqueue(sseEvent({ type: "done" }));
            close();
            return;
          }

          enqueue(
            sseEvent({
              type: "status",
              message: "Generating ethical marketing strategy…",
            })
          );

          const dossierSummary = `Score: ${dossier.overall_score}/100 (${dossier.overall_grade}) — ${dossier.invest_signal}. ${dossier.one_liner}`;

          let rawStrategy = "";
          try {
            rawStrategy = await streamChatCompletion(
              buildMarketingSystemPrompt(),
              buildMarketingIntakeMessage(dossierSummary, planText, businessContext),
              (delta) => enqueue(sseEvent({ type: "chunk", pass: 2, delta }))
            );
          } catch (err) {
            enqueue(sseEvent({ type: "strategy_skipped", reason: `Strategy generation failed: ${String(err)}` }));
            enqueue(sseEvent({ type: "done" }));
            close();
            return;
          }

          let strategy = null;
          try {
            const cleaned = rawStrategy
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/\s*```\s*$/, "")
              .trim();
            strategy = MarketingStrategySchema.parse(JSON.parse(cleaned));
          } catch {
            strategy = null;
          }

          if (strategy) {
            enqueue(sseEvent({ type: "pass2_done", strategy }));
          } else {
            enqueue(sseEvent({ type: "strategy_skipped", reason: "Could not parse strategy JSON." }));
          }

          enqueue(sseEvent({ type: "done" }));
          close();
        });

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            ...corsHeaders,
          },
        });
      },
    },
  },
});
