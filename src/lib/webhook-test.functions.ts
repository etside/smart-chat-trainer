import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "./admin.server";
import { transcribeAudio } from "./ai.server";
import { generateReply } from "./agent.server";
import { evaluateAutoReplyRules } from "./auto-reply.engine";

export const testWebhookPayload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        type: z.enum(["text", "voice"]),
        message: z.string().optional(),
        audio: z.string().optional(),
        mimeType: z.string().optional(),
        sender: z.string().default("test_user"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let textMessage: string = data.message || "";
    let transcriptionResult: string | null = null;

    if (data.type === "voice" && data.audio) {
      const { data: settings } = await supabaseAdmin
        .from("agent_settings")
        .select("lovable_api_key_override")
        .eq("id", 1)
        .maybeSingle();
      
      const audioContent: string = data.audio;
      transcriptionResult = await transcribeAudio(audioContent, data.mimeType || "audio/webm", settings?.lovable_api_key_override);
      textMessage = transcriptionResult;
    }

    if (!textMessage) {
      throw new Error("No message content found");
    }

    // Step 1: Try auto-reply template matching first
    const autoReplyResult = await evaluateAutoReplyRules(textMessage, `test-${data.sender}`, 0);

    let reply: string;
    let templateMatched = false;
    let templateName: string | null = null;
    let matchConfidence = 0;

    if (autoReplyResult && autoReplyResult.confidence >= 0.5) {
      // Use the matched template
      reply = autoReplyResult.templateText;
      templateMatched = true;
      templateName = autoReplyResult.templateName;
      matchConfidence = autoReplyResult.confidence;
    } else {
      // Fall back to AI generation
      const result = await generateReply(textMessage, []);
      reply = result.reply;
    }

    // Log conversation
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .insert({
        source: "webhook_test",
        external_id: data.sender,
      } as any)
      .select()
      .single();

    if (conv) {
      await supabaseAdmin.from("messages").insert([
        { conversation_id: conv.id, role: "user", content: textMessage },
        { conversation_id: conv.id, role: "assistant", content: reply },
      ] as any);
    }

    return {
      transcription: transcriptionResult,
      reply,
      templateMatched,
      templateName,
      matchConfidence,
      examplesCount: autoReplyResult ? 1 : 0,
      conversationId: conv?.id,
      source: templateMatched ? "auto-reply template" : "AI generation",
    };
  });
