import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  extractPairsFromText,
  importConversationsJson,
  importPairs,
  savePair,
} from "@/lib/console.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Sparkles, Terminal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/add")({
  component: AddData,
});

type Pair = { question: string; answer: string };

function AddData() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">নতুন ডেটা যোগ করুন</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        যা যোগ করবেন, AI সঙ্গে সঙ্গে সেটা থেকে উত্তর দিতে শুরু করবে।
      </p>

      <Tabs defaultValue="voice" className="mt-6">
        <TabsList>
          <TabsTrigger value="voice">ভয়েস</TabsTrigger>
          <TabsTrigger value="manual">প্রশ্ন-উত্তর</TabsTrigger>
          <TabsTrigger value="json">JSON আপলোড</TabsTrigger>
        </TabsList>

        <TabsContent value="voice" className="mt-4">
          <VoicePanel />
        </TabsContent>
        <TabsContent value="manual" className="mt-4">
          <ManualPanel />
        </TabsContent>
        <TabsContent value="json" className="mt-4">
          <JsonPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VoicePanel() {
  const [text, setText] = useState("");
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const extract = useServerFn(extractPairsFromText);
  const save = useServerFn(importPairs);

  async function runExtract() {
    if (text.trim().length < 3) return;
    setBusy(true);
    try {
      const { items } = await extract({ data: { text: text.trim() } });
      if (!items.length) {
        toast.error("কোনো প্রশ্ন-উত্তর বের করা যায়নি, নিজে লিখে দিন।");
      } else {
        setPairs(items);
        setShowPreview(true);
      }
    } catch {
      toast.error("প্রসেস করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    const items = pairs.filter((p) => p.question.trim() && p.answer.trim());
    if (!items.length) return;
    setBusy(true);
    try {
      await save({ data: { items, source: "voice" } });
      toast.success(`${items.length} টি জোড়া ট্রেনিংয়ে যোগ হয়েছে`);
      setPairs([]);
      setText("");
      setShowPreview(false);
    } catch {
      toast.error("সেভ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel space-y-4 p-5 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <VoiceRecorder onText={(t) => {
          setText((prev) => (prev ? prev + " " + t : t));
          setShowPreview(false); // Ensure preview is reset so user can confirm new text
        }} />
        {busy && <div className="animate-pulse flex items-center gap-2 text-[10px] text-primary font-black uppercase tracking-widest"><Sparkles className="size-3" /> Processing...</div>}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="voice-text" className="font-bold tracking-tight">ট্রান্সক্রিপ্ট প্রিভিউ (Confirm/Edit Transcript)</Label>
          {text && <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setText("")}><Trash2 className="size-3 mr-1" /> Clear</Button>}
        </div>
        <Textarea
          id="voice-text"
          rows={6}
          placeholder="ভয়েস রেকর্ড করলে এখানে লেখা আসবে — চাইলে এডিটও করতে পারবেন।"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (showPreview) setShowPreview(false);
          }}
          className="bg-card/40 focus:bg-background transition-all focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {!showPreview && (
        <Button onClick={runExtract} disabled={busy || text.trim().length < 3}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          প্রশ্ন-উত্তরে রূপান্তর ও প্রিভিউ
        </Button>
      )}

      {showPreview && pairs.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          {pairs.map((p, i) => (
            <div key={i} className="rounded-lg bg-secondary/60 p-3">
              <Input
                className="bg-card"
                value={p.question}
                onChange={(e) =>
                  setPairs((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)),
                  )
                }
              />
              <Textarea
                className="mt-2 bg-card"
                rows={3}
                value={p.answer}
                onChange={(e) =>
                  setPairs((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setPairs((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" /> বাদ দিন
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button onClick={saveAll} disabled={busy} className="flex-1">
              সব চেক করেছি, সেভ করুন
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={busy}>
              বাতিল
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePair);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { question: question.trim(), answer: answer.trim(), source: "manual" } });
      toast.success("যোগ হয়েছে");
      setQuestion("");
      setAnswer("");
    } catch {
      toast.error("সেভ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel space-y-4 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="q">কাস্টমারের প্রশ্ন</Label>
        <Textarea
          id="q"
          rows={2}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="যেমন: ডেলিভারি চার্জ কত?"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a">আপনার উত্তর</Label>
        <Textarea
          id="a"
          rows={4}
          required
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="যেমন: ঢাকার ভিতরে ৮০ টাকা, ঢাকার বাইরে ১৩০ টাকা।"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "সেভ হচ্ছে..." : "ট্রেনিংয়ে যোগ করুন"}
      </Button>
    </form>
  );
}

function JsonPanel() {
  const [busy, setBusy] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [preview, setPreview] = useState<{ conversations: number; messages: number } | null>(null);
  const importJson = useServerFn(importConversationsJson);

  async function handleValidate() {
    if (!jsonText.trim()) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of conversations.");
      
      let messageCount = 0;
      parsed.forEach((conv: any, i: number) => {
        if (!conv.messages || !Array.isArray(conv.messages)) {
          throw new Error(`Conversation at index ${i} is missing messages array.`);
        }
        messageCount += conv.messages.length;
      });

      setPreview({ conversations: parsed.length, messages: messageCount });
      toast.success("JSON সঠিক ফরম্যাটে আছে। প্রিভিউ দেখুন।");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ভুল JSON ফরম্যাট।");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!jsonText.trim()) return;
    setBusy(true);
    try {
      const result = await importJson({ data: { json: jsonText } });
      toast.success(
        `${result.conversations} কথোপকথন, ${result.pairs} ট্রেনিং জোড়া যোগ হয়েছে`,
      );
      setJsonText("");
      setPreview(null);
    } catch (error) {
      toast.error("আপলোড ব্যর্থ হয়েছে।");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonText(text);
    e.target.value = "";
    toast.info("ফাইল লোড হয়েছে, ভ্যালিডেট বাটনে ক্লিক করুন।");
  }

  return (
    <div className="panel space-y-4 p-5">
      <div className="space-y-2">
        <Label htmlFor="json-text">JSON ডেটা পেস্ট করুন</Label>
        <Textarea 
          id="json-text" 
          rows={8} 
          placeholder='[{"conversation_id":"...","messages":[...]}]'
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setPreview(null);
          }}
          className="font-mono text-xs"
        />
        
        {preview ? (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1 animate-in slide-in-from-top-2">
            <p className="font-bold text-primary flex items-center gap-2">
              <Sparkles className="size-3" /> প্রিভিউ:
            </p>
            <p>মোট কথোপকথন: {preview.conversations}</p>
            <p>মোট মেসেজ: {preview.messages}</p>
            <Button 
              className="w-full mt-2" 
              variant="default"
              size="sm"
              disabled={busy} 
              onClick={handleImport}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 mr-2" />}
              কনফার্ম ও ইমপোর্ট করুন
            </Button>
          </div>
        ) : (
          <Button 
            className="w-full" 
            size="sm" 
            disabled={busy || !jsonText.trim()} 
            onClick={handleValidate}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Terminal className="size-4 mr-2" />}
            ভ্যালিডেট ও প্রিভিউ
          </Button>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground text-[10px]">অথবা ফাইল সিলেক্ট করুন</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="json-file">ফাইল আপলোড (JSON)</Label>
        <Input id="json-file" type="file" accept="application/json" onChange={onFile} disabled={busy} />
      </div>
      
      <p className="text-[10px] text-muted-foreground leading-relaxed italic">
        * ফরম্যাট: <code>[{"{"}"conversation_id":"...","messages":[{"{"}"role":"user","content":"..."{"}"}]{"}"}]</code>
      </p>
    </div>
  );
}