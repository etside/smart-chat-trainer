import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { transcribeVoice } from "@/lib/console.functions";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square, Sparkles } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoiceRecorder({ onText, onAudioBlob }: { onText: (text: string) => void, onAudioBlob?: (blob: Blob) => void }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcribe = useServerFn(transcribeVoice);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 1000) {
          toast.error("রেকর্ডিং খুব ছোট হয়ে গেছে।");
          return;
        }
        if (onAudioBlob) {
          onAudioBlob(blob);
          return;
        }
        setBusy(true);
        try {
          const { text } = await transcribe({
            data: { 
              audio: await blobToBase64(blob), 
              mimeType: blob.type || (recorder.mimeType === 'audio/x-m4a' ? 'audio/mp4' : 'audio/webm') 
            },
          });
          if (text.trim()) onText(text.trim());
          else toast.error("কোনো কথা শোনা যায়নি।");
        } catch {
          toast.error("ট্রান্সক্রাইব করা যায়নি, আবার চেষ্টা করুন।");
        } finally {
          setBusy(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setRecording(true);
    } catch {
      toast.error("মাইক্রোফোনের অনুমতি পাওয়া যায়নি।");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant={recording ? "destructive" : "default"}
        onClick={recording ? stop : start}
        disabled={busy}
        className={cn(
          "transition-all duration-300",
          recording ? "bg-destructive shadow-lg shadow-destructive/20 scale-105" : "shadow-md hover:shadow-lg"
        )}
      >
        {busy ? (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span className="flex items-center gap-1.5">
              AI Processing <Sparkles className="size-3 text-accent animate-pulse" />
            </span>
          </div>
        ) : recording ? (
          <div className="flex items-center gap-2">
            <Square className="size-4 fill-white" />
            <span>থামান</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Mic className="size-4" />
            <span>ভয়েস রেকর্ড</span>
          </div>
        )}
      </Button>
      {recording && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
