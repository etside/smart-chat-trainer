import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { playgroundReply } from "@/lib/console.functions";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Database, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";


export const Route = createFileRoute("/admin/playground")({
  component: Playground,
});

type Msg = { 
  role: "user" | "assistant"; 
  content: string;
  examples?: Array<{ question: string; answer: string }>;
};


function Playground() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const reply = useServerFn(playgroundReply);
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});

  const toggleSources = (index: number) => {
    setShowSources(prev => ({ ...prev, [index]: !prev[index] }));
  };

  async function send(text: string) {

    const message = text.trim();
    if (!message || busy) return;
    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await reply({ data: { message, history } });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, examples: res.examples }]);
    } catch {

      toast.error("উত্তর তৈরি করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <h1 className="text-2xl font-semibold">প্লেগ্রাউন্ড</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        কাস্টমারের মতো প্রশ্ন করুন — এজেন্ট ট্রেনিং ডেটা দেখে উত্তর দেবে।
      </p>

      <div className="panel mt-6 flex min-h-[50vh] flex-col gap-3 p-5">
        {messages.length === 0 && (
          <p className="m-auto text-sm text-muted-foreground">
            যেমন: "দাম কত?" বা "ডেলিভারি কতদিনে পাবো?"
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
              m.role === "user"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-secondary text-secondary-foreground",
            )}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="self-start rounded-2xl bg-secondary px-4 py-2.5">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <VoiceRecorder onText={(t) => setInput((prev) => (prev ? prev + " " + t : t))} />
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <Textarea
            rows={2}
            value={input}
            placeholder="মেসেজ লিখুন..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
