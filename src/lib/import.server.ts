import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RawConversation = {
  conversation_id?: string;
  messages?: Array<{ role?: string; content?: string }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export async function importConversationExport(json: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("ফাইলটি সঠিক JSON নয়।");
  }

  const list: RawConversation[] = Array.isArray(parsed)
    ? (parsed as RawConversation[])
    : [parsed as RawConversation];

  let conversations = 0;
  let messages = 0;
  const pairs: Array<{ question: string; answer: string; conversation_id: string }> = [];

  for (const conv of list.slice(0, 3000)) {
    const turns = (conv.messages ?? [])
      .map((m) => ({ role: m.role, content: clean(m.content).slice(0, 4000) }))
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          (m.role === "user" || m.role === "assistant") && m.content.length > 0,
      );
    if (!turns.length) continue;

    const { data: inserted } = await supabaseAdmin
      .from("conversations")
      .insert({ external_id: conv.conversation_id ?? null, source: "upload" })
      .select("id")
      .single();
    if (!inserted) continue;
    conversations += 1;

    await supabaseAdmin.from("messages").insert(
      turns.map((t, i) => ({
        conversation_id: inserted.id,
        role: t.role,
        content: t.content,
        seq: i,
      })),
    );
    messages += turns.length;

    let pending: string[] = [];
    for (const turn of turns) {
      if (turn.role === "user") {
        pending.push(turn.content);
      } else if (pending.length) {
        const question = pending.slice(-2).join(" | ");
        if (question.length >= 6 && question.length <= 600) {
          pairs.push({ question, answer: turn.content, conversation_id: inserted.id });
        }
        pending = [];
      }
    }
  }

  for (let i = 0; i < pairs.length; i += 500) {
    await supabaseAdmin.from("training_pairs").insert(
      pairs.slice(i, i + 500).map((p) => ({ ...p, source: "upload", status: "approved" })),
    );
  }

  return { conversations, messages, pairs: pairs.length };
}
