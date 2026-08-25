import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { playgroundReply } from "@/lib/console.functions";
import { textToSpeech } from "@/lib/tts.functions";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Database, ChevronDown, ChevronUp, Volume2 } from "lucide-react";
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
  const tts = useServerFn(textToSpeech);
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const toggleSources = (index: number) => {
    setShowSources(prev => ({ ...prev, [index]: !prev[index] }));
  };

  async function playTTS(text: string, idx: number) {
    try {
      setPlayingIdx(idx);
      const res = await tts({ data: { text: text.slice(0, 1000) } });
      const audioSrc = `data:${res.mimeType};base64,${res.audio}`;
      const audio = new Audio(audioSrc);
      audio.onended = () => setPlayingIdx(null);
      audio.onerror = () => { setPlayingIdx(null); toast.error("অডিও চালানো যায়নি"); };
      await audio.play();
    } catch (e: any) {
      setPlayingIdx(null);
      toast.error(e?.message || "TTS কাজ করেনি। Fish Audio API Key চেক করুন।");
    }
  }

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
          <div key={i} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm transition-all",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card/60 backdrop-blur-md border border-white/5 text-foreground",
              )}
            >
              {m.content}
            </div>
            {m.role === "assistant" && (
              <button
                onClick={() => playTTS(m.content, i)}
                disabled={playingIdx === i}
                className="ml-2 p-1 rounded-full hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
                title="শুনুন (TTS)"
              >
                {playingIdx === i ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Volume2 className="size-3.5" />
                )}
              </button>
            )}
            
            {m.role === "assistant" && m.examples && m.examples.length > 0 && (
              <div className="flex flex-col gap-2 w-full max-w-[90%]">
                <button 
                  onClick={() => toggleSources(i)}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors ml-2 uppercase tracking-widest font-bold"
                >
                  <Database className="size-3" />
                  RAG Sources
                  {showSources[i] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>
                
                {showSources[i] && (
                  <div className="grid gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    {m.examples.map((ex, idx) => (
                      <div key={idx} className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-[11px] space-y-1">
                        <div className="font-bold text-primary/80">প্রশ্ন: {ex.question}</div>
                        <div className="text-muted-foreground">উত্তর: {ex.answer}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
