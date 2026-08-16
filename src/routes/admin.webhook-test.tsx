import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { testWebhookPayload } from "@/lib/webhook-test.functions";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Mic, Send, Terminal, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/webhook-test")({
  component: WebhookTest,
});

function WebhookTest() {
  const [activeTab, setActiveTab] = useState<"text" | "voice">("text");
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("tester_123");
  const [logs, setLogs] = useState<any[]>([]);

  const testFn = useServerFn(testWebhookPayload);

  const mutation = useMutation({
    mutationFn: async (payload: { type: "text" | "voice"; message?: string; audio?: string; mimeType?: string }) => {
      return testFn({
        data: {
          ...payload,
          sender,
        },
      });
    },
    onSuccess: (data) => {
      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          type: "success",
          ...data,
        },
        ...prev,
      ]);
      toast.success("টেস্ট সম্পন্ন হয়েছে");
    },
    onError: (err: any) => {
      setLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          type: "error",
          error: err.message,
        },
        ...prev,
      ]);
      toast.error("টেস্ট ব্যর্থ হয়েছে");
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2">
        <Terminal className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold">ওয়েবহুক টেস্ট প্যানেল</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        এক্সটার্নাল প্লাটফর্ম থেকে আসা ভয়েস বা টেক্সট পেলোড সিমুলেট করুন এবং AI-এর রেসপন্স যাচাই করুন।
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="panel p-5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="size-4 text-warning" /> টেস্ট পেলোড
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="sender">সেন্ডার আইডি (Sender ID)</Label>
                <Input 
                  id="sender" 
                  value={sender} 
                  onChange={(e) => setSender(e.target.value)} 
                  placeholder="e.g. customer_99"
                  className="mt-1"
                />
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" className="gap-2">
                    <MessageSquare className="size-4" /> টেক্সট
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="gap-2">
                    <Mic className="size-4" /> ভয়েস
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="message">মেসেজ কন্টেন্ট</Label>
                    <Input 
                      id="message" 
                      value={message} 
                      onChange={(e) => setMessage(e.target.value)} 
                      placeholder="যেমন: আপনাদের ডেলিভারি চার্জ কত?"
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => mutation.mutate({ type: "text", message })}
                    disabled={!message || mutation.isPending}
                  >
                    {mutation.isPending ? "প্রসেসিং..." : "টেস্ট টেক্সট পাঠান"} <Send className="ml-2 size-4" />
                  </Button>
                </TabsContent>

                <TabsContent value="voice" className="mt-4">
                  <div className="rounded-lg border bg-card p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-4">অডিও রেকর্ড করে ওয়েববহুক পেলোড হিসেবে পাঠান</p>
                    <VoiceRecorder 
                      onTranscription={() => {}}
                      onAudioBlob={async (blob) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onloadend = () => {
                          const base64 = (reader.result as string).split(",")[1];
                          mutation.mutate({ type: "voice", audio: base64, mimeType: blob.type });
                        };
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Terminal className="size-4" /> আউটপুট লগ
          </h2>
          <div className="panel h-[500px] overflow-y-auto bg-slate-950 p-4 font-mono text-xs text-slate-300">
            {logs.length === 0 ? (
              <p className="text-slate-500 italic">এখনো কোনো টেস্ট করা হয়নি...</p>
            ) : (
              <div className="space-y-4">
                {logs.map((log, i) => (
                  <div key={i} className={`border-l-2 pl-3 ${log.type === 'error' ? 'border-red-500' : 'border-green-500'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-500">[{log.timestamp}]</span>
                      <span className={log.type === 'error' ? 'text-red-400' : 'text-green-400'}>
                        {log.type.toUpperCase()}
                      </span>
                    </div>
                    {log.type === 'error' ? (
                      <p className="text-red-300">{log.error}</p>
                    ) : (
                      <div className="space-y-2">
                        {log.transcription && (
                          <div>
                            <span className="text-primary">TRANSCRIPTION:</span> {log.transcription}
                          </div>
                        )}
                        <div>
                          <span className="text-primary">AI REPLY:</span> {log.reply}
                        </div>
                        {log.sources && log.sources.length > 0 && (
                          <div>
                            <span className="text-primary">SOURCES:</span> {log.sources.length} matches found
                          </div>
                        )}
                        {log.conversationId && (
                          <div className="text-[10px] text-slate-500">
                            Conversation ID: {log.conversationId} (Log saved to DB)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
