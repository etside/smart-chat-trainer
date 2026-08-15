import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { chatComplete, type ChatMessage } from "./ai.server";

export type HistoryTurn = { role: "user" | "assistant"; content: string };

export async function getSettings() {
  const { data } = await supabaseAdmin
    .from("agent_settings")
    .select("system_prompt, model, auto_approve")
    .eq("id", 1)
    .maybeSingle();

  return {
    system_prompt: data?.system_prompt ?? "",
    model: data?.model ?? "openai/gpt-5.6-sol",
    auto_approve: data?.auto_approve ?? false,
  };
}

export async function findExamples(query: string, limit = 8) {
  const { data } = await supabaseAdmin.rpc("search_training_pairs", {
    _query: query.slice(0, 300),
    _limit: limit,
  });
  return (data ?? []) as Array<{ question: string; answer: string; score: number }>;
}

export async function generateReply(
  message: string,
  history: HistoryTurn[] = [],
): Promise<{ reply: string; examples: Array<{ question: string; answer: string }> }> {
  const settings = await getSettings();
  const examples = await findExamples(message);

  const exampleBlock = examples.length
    ? examples
        .map((e, i) => `উদাহরণ ${i + 1}:\nকাস্টমার: ${e.question}\nআমরা: ${e.answer}`)
        .join("\n\n")
    : "কোনো মিল পাওয়া যায়নি।";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${settings.system_prompt}

নিচে আমাদের আগের আসল কথোপকথন থেকে সবচেয়ে মিল থাকা উদাহরণ দেওয়া হলো। এই টোন, ভাষা ও তথ্য অনুসরণ করে উত্তর দাও। উত্তর ছোট রাখো (১-৩ লাইন), ঠিক যেভাবে পেজ থেকে রিপ্লাই দেওয়া হয়।

${exampleBlock}`,
    },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
    { role: "user", content: message },
  ];

  const reply = await chatComplete(messages, settings.model);
  return { reply, examples: examples.map((e) => ({ question: e.question, answer: e.answer })) };
}

export async function logConversation(
  externalId: string | null,
  source: string,
  turns: HistoryTurn[],
) {
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .insert({ external_id: externalId, source })
    .select("id")
    .single();

  if (!conv) return;

  await supabaseAdmin.from("messages").insert(
    turns.map((t, i) => ({
      conversation_id: conv.id,
      role: t.role,
      content: t.content,
      seq: i,
    })),
  );

  const settings = await getSettings();
  const question = turns.filter((t) => t.role === "user").at(-1)?.content;
  const answer = turns.filter((t) => t.role === "assistant").at(-1)?.content;
  if (question && answer) {
    await supabaseAdmin.from("training_pairs").insert({
      question,
      answer,
      source,
      status: settings.auto_approve ? "approved" : "pending",
      conversation_id: conv.id,
    });
  }
}
