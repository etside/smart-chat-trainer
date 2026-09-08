import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { testWebhookPayload } from "@/lib/webhook-test.functions";
import { getWebhookLogs } from "@/lib/webhook-logs.functions";
import { syncCatalog } from "@/lib/sync.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare, Mic, Send, Terminal, Zap, RefreshCw, FileCode,
  Copy, Download, History, Activity, ShieldCheck, PlayCircle,
  Bot, User, CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/webhook-test")({
  component: WebhookTest,
});

// ── Chat message type ────────────────────────────────────────────────────────
type TestMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  source?: string;
  templateName?: string | null;
  confidence?: number;
  transcription?: string | null;
};

function ChatBubble({ msg }: { msg: TestMessage }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 bg-muted/40 border border-border/30 rounded-full px-4 py-1.5 text-[11px] text-muted-foreground">
          {msg.source === "auto-reply template" ? (
            <>
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Template: <strong className="text-foreground">{msg.templateName}</strong></span>
              {msg.confidence && (
                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold">
                  {Math.round(msg.confidence * 100)}% match
                </span>
              )}
            </>
          ) : msg.source === "AI generation" ? (
            <>
              <Sparkles className="size-3 text-primary" />
              <span>AI generated reply</span>
            </>
          ) : (
            <>
              <AlertCircle className="size-3 text-amber-500" />
              <span>{msg.content}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-3 my-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
          <Bot className="size-4 text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-muted/60 border border-border/30 rounded-bl-md"
      )}>
        {msg.transcription && (
          <div className="mb-2 pb-2 border-b border-border/20 text-[11px] text-muted-foreground">
            <Mic className="size-3 inline mr-1" /> Transcribed: {msg.transcription}
          </div>
        )}
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
      {isUser && (
        <div className="size-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mt-1">
          <User className="size-4 text-blue-500" />
        </div>
      )}
    </div>
  );
}

function WebhookTest() {
  const [activeTab, setActiveTab] = useState<"text" | "voice">("text");
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("tester_123");
  const [messages, setMessages] = useState<TestMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome to the Webhook Test Panel! Type a message below to test how the AI responds. The system will first check auto-reply templates, then fall back to AI generation.",
      timestamp: new Date(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const testFn = useServerFn(testWebhookPayload);
  const fetchLogs = useServerFn(getWebhookLogs);
  const triggerSync = useServerFn(syncCatalog);

  const { data: dbLogs } = useQuery({
    queryKey: ["webhook-db-logs"],
    queryFn: () => fetchLogs(),
    refetchInterval: 10000
  });

  const syncMutation = useMutation({
    mutationFn: async () => triggerSync(),
    onSuccess: (data: any) => {
      toast.success(`Sync finished: ${data.message || "Done"}`);
      queryClient.invalidateQueries({ queryKey: ["webhook-db-logs"] });
    },
    onError: (error: any) => {
      toast.error("Sync failed");
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendText = async () => {
    const text = message.trim();
    if (!text || isSending) return;

    const userMsg: TestMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setMessage("");
    setIsSending(true);

    try {
      const result = await testFn({
        data: { type: "text", message: text, sender },
      });

      // System message about match source
      const sysMsg: TestMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: "",
        timestamp: new Date(),
        source: result.source,
        templateName: result.templateName,
        confidence: result.matchConfidence,
      };
      setMessages(prev => [...prev, sysMsg]);

      // Assistant reply
      const assistantMsg: TestMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
        timestamp: new Date(),
        source: result.source,
        templateName: result.templateName,
      };
      setMessages(prev => [...prev, assistantMsg]);

      queryClient.invalidateQueries({ queryKey: ["webhook-db-logs"] });
      toast.success("Test completed");
    } catch (err: any) {
      const errMsg: TestMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: `Error: ${err.message || "Test failed"}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
      toast.error("Test failed");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleVoice = async (blob: Blob) => {
    setIsSending(true);
    const userMsg: TestMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: "[Voice message]",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const result_str = reader.result as string;
        const base64 = result_str.split(",")[1];
        if (base64) {
          const result = await testFn({
            data: { type: "voice", audio: base64, mimeType: blob.type, sender },
          });

          if (result.transcription) {
            // Update user message with transcription
            setMessages(prev => prev.map(m =>
              m.id === userMsg.id ? { ...m, content: result.transcription || "[Voice message]" } : m
            ));
          }

          const sysMsg: TestMessage = {
            id: crypto.randomUUID(),
            role: "system",
            content: "",
            timestamp: new Date(),
            source: result.source,
            templateName: result.templateName,
            confidence: result.matchConfidence,
          };
          setMessages(prev => [...prev, sysMsg]);

          const assistantMsg: TestMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.reply,
            timestamp: new Date(),
            transcription: result.transcription,
          };
          setMessages(prev => [...prev, assistantMsg]);

          queryClient.invalidateQueries({ queryKey: ["webhook-db-logs"] });
          toast.success("Voice test completed");
        }
        setIsSending(false);
      };
    } catch (err: any) {
      const errMsg: TestMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: `Error: ${err.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
      setIsSending(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Chat cleared. Type a message to test.",
      timestamp: new Date(),
    }]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const handleExport = (data: any[], filename: string) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", filename);
    link.click();
  };

  const textPayload = JSON.stringify({
    type: "text",
    message: "ডেলিভারি চার্জ কত?",
    sender: "user_123"
  }, null, 2);

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Terminal className="size-6 text-primary" />
            Webhook Test Panel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Test auto-reply templates and AI responses in real-time
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport(dbLogs || [], "webhook_logs.json")}>
            <Download className="mr-2 size-4" /> Export Logs
          </Button>
          <Button variant="outline" size="sm" onClick={clearChat}>
            <RefreshCw className="mr-2 size-4" /> Clear
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* ── Chat Area (main) ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col h-[60vh] md:h-[calc(100vh-16rem)] rounded-xl border border-border/40 bg-background/50 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {isSending && (
              <div className="flex gap-3 my-3 justify-start">
                <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="size-4 text-primary" />
                </div>
                <div className="bg-muted/60 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Processing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/30 p-3 md:p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-[10px] text-muted-foreground">Sender:</Label>
              <Input
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="h-7 w-40 text-xs"
                placeholder="sender_id"
              />
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2 mb-3">
                <TabsTrigger value="text" className="gap-2 text-xs">
                  <MessageSquare className="size-3.5" /> Text
                </TabsTrigger>
                <TabsTrigger value="voice" className="gap-2 text-xs">
                  <Mic className="size-3.5" /> Voice
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-0">
                <form onSubmit={(e) => { e.preventDefault(); handleSendText(); }} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a customer message... (e.g., 'দাম কত?' or 'Do you have this in blue?')"
                    className="flex-1 h-10"
                    disabled={isSending}
                  />
                  <Button type="submit" disabled={!message.trim() || isSending} className="h-10 px-4">
                    {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="voice" className="mt-0">
                <div className="flex items-center justify-center py-2">
                  <VoiceRecorder
                    onText={() => {}}
                    onAudioBlob={handleVoice}
                  />
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1"><Zap className="size-3" /> Auto-reply templates checked first</span>
              <span className="flex items-center gap-1"><Sparkles className="size-3" /> AI fallback if no template matches</span>
            </div>
          </div>
        </div>

        {/* ── Side Panel ────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Sync */}
          <div className="panel p-5">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <RefreshCw className="size-4 text-primary" /> Quick Sync
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Sync product catalog from external platform.
            </p>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="w-full"
              size="sm"
            >
              {syncMutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <PlayCircle className="size-4 mr-2" />}
              Run Sync
            </Button>
          </div>

          {/* API Schema */}
          <div className="panel p-5">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <FileCode className="size-4 text-primary" /> API Schema
            </h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Text Payload</span>
                  <button onClick={() => copyToClipboard(textPayload)} className="text-primary hover:underline text-[10px] flex items-center gap-1">
                    <Copy className="size-3" /> Copy
                  </button>
                </div>
                <pre className="bg-muted text-foreground p-2 rounded text-[10px] overflow-x-auto">
                  {textPayload}
                </pre>
              </div>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p><strong>Endpoint:</strong> POST /api/public/webhook</p>
                <p><strong>Auth:</strong> x-api-key or x-webhook-signature (HMAC)</p>
                <p><strong>Response:</strong> reply, transcription, status</p>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="panel p-5">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <History className="size-4 text-primary" /> Recent Logs
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {dbLogs?.slice(0, 10).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-[10px] p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "size-1.5 rounded-full",
                      log.processing_status === "success" ? "bg-emerald-500" :
                      log.processing_status === "failed" ? "bg-destructive" :
                      log.processing_status === "pending" ? "bg-amber-500" :
                      "bg-muted-foreground"
                    )} />
                    <span className="text-muted-foreground truncate max-w-[120px]">
                      {log.event_type || "message"}
                    </span>
                  </div>
                  <span className="text-muted-foreground/60">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {(!dbLogs || dbLogs.length === 0) && (
                <p className="text-[10px] text-muted-foreground italic">No logs yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
