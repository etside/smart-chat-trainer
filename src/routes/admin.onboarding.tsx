import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { KeyRound, Webhook, CheckCircle2, ArrowRight, ShieldCheck, Database, Mic, Loader2, Sparkles, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { transcribeVoice, triggerTraining } from "@/lib/console.functions";

export const Route = createFileRoute("/admin/onboarding")({
  component: OnboardingWizard,
});

function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const transcribe = useServerFn(transcribeVoice);
  const startTraining = useServerFn(triggerTraining);

  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "transcribing" | "ingesting" | "success" | "failed">("idle");

  const runEndToEndTest = async () => {
    setIsTestRunning(true);
    setTestStatus("transcribing");
    try {
      // 1. Simulate voice data (small base64 wave stub)
      const dummyAudio = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; 
      
      toast.info("ভয়েস ট্রান্সক্রিপশন শুরু হচ্ছে...");
      const { text } = await transcribe({ data: { audio: dummyAudio, mimeType: "audio/wav" } });
      
      setTestStatus("ingesting");
      toast.info(`ট্রান্সক্রিপশন সফল: "${text}". ইনজেশন শুরু হচ্ছে...`);

      // 2. Trigger training run
      const { job_id } = await startTraining({ data: {} });
      
      setTestStatus("success");
      toast.success("এন্ড-টু-এন্ড টেস্ট সফল হয়েছে!");
    } catch (err) {
      setTestStatus("failed");
      toast.error("টেস্ট ব্যর্থ হয়েছে। দয়া করে সেটিংস চেক করুন।");
    } finally {
      setIsTestRunning(false);
    }
  };

  const next = () => setStep(s => s + 1);

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold italic mb-2">Setup <span className="text-primary">Daddy AI</span></h1>
        <p className="text-muted-foreground">৩টি ধাপে আপনার সেলস এজেন্ট প্রস্তুত করুন</p>
      </div>

      <div className="relative mb-8">
        <div className="flex justify-between relative z-10">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`size-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step >= s ? "bg-primary border-primary text-white" : "bg-card border-border text-muted-foreground"}`}>
              {step > s ? <CheckCircle2 className="size-6" /> : s}
            </div>
          ))}
        </div>
        <div className="absolute top-5 left-0 w-full h-0.5 bg-border -z-0">
          <div className="h-full bg-primary transition-all" style={{ width: `${(step - 1) * 33.33}%` }} />
        </div>
      </div>

      <div className="panel p-8 min-h-[400px] flex flex-col">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4">
             <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
               <KeyRound className="size-8 text-primary" />
             </div>
             <h2 className="text-2xl font-bold mb-4 italic">API Key জেনারেট করুন</h2>
             <p className="text-muted-foreground mb-8 leading-relaxed">
               আপনার ই-কমার্স প্ল্যাটফর্ম বা মেটা বিজনেসের সাথে কানেক্ট করার জন্য একটি সিকিউর API Key প্রয়োজন। এটি আপনার ডেটা সিঙ্ক করতে ব্যবহার হবে।
             </p>
             <div className="mt-auto">
               <Button onClick={next} className="rounded-full px-8">কী জেনারেট করুন <ArrowRight className="ml-2 size-4" /></Button>
             </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4">
             <div className="size-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
               <Webhook className="size-8 text-accent" />
             </div>
             <h2 className="text-2xl font-bold mb-4 italic">এন্ডপয়েন্ট কনফিগারেশন</h2>
             <p className="text-muted-foreground mb-8 leading-relaxed">
               আপনার শপের ওয়েবহুক ইউআরএল সেটআপ করুন। এতে নতুন অর্ডার বা ইনভেন্টরি আপডেট হলে AI অটোমেটিক ট্রেনিং শুরু করবে।
             </p>
             <div className="mt-auto">
               <Button onClick={next} className="rounded-full px-8">কানেক্ট করুন <ArrowRight className="ml-2 size-4" /></Button>
             </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4">
             <div className="size-16 rounded-2xl bg-success/10 flex items-center justify-center mb-6">
               <Database className="size-8 text-success" />
             </div>
             <h2 className="text-2xl font-bold mb-4 italic">প্রথম ট্রেনিং ইনজেশন</h2>
             <p className="text-muted-foreground mb-8 leading-relaxed">
               সবকিছু ঠিক আছে কি না যাচাই করতে একটি টেস্ট ট্রেনিং রিকুয়েস্ট পাঠান। এটি সফল হলে পরবর্তী ধাপে যান।
             </p>
             <div className="mt-auto">
               <Button onClick={next} className="rounded-full px-8">পরবর্তী ধাপ <ArrowRight className="ml-2 size-4" /></Button>
             </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-right-4">
             <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
               <Sparkles className="size-8 text-primary" />
             </div>
             <h2 className="text-2xl font-bold mb-4 italic">এন্ড-টু-এন্ড টেস্ট (Test Run)</h2>
             <p className="text-muted-foreground mb-8 leading-relaxed">
               একটি টেস্ট ভয়েস মেসেজ পাঠিয়ে আপনার কনফিগারেশন যাচাই করুন। এটি ট্রান্সক্রিপশন থেকে শুরু করে JSON ইনজেশন পর্যন্ত সবকিছু চেক করবে।
             </p>
             
             <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-white/5">
                  <div className="flex items-center gap-3">
                    <Mic className={cn("size-5", testStatus === "transcribing" ? "text-primary animate-pulse" : "text-muted-foreground")} />
                    <span className="text-sm">ভয়েস ট্রান্সক্রিপশন</span>
                  </div>
                  {testStatus === "transcribing" && <Loader2 className="size-4 animate-spin" />}
                  {(testStatus === "ingesting" || testStatus === "success") && <CheckCircle2 className="size-4 text-success" />}
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-white/5">
                  <div className="flex items-center gap-3">
                    <Database className={cn("size-5", testStatus === "ingesting" ? "text-primary animate-pulse" : "text-muted-foreground")} />
                    <span className="text-sm">JSON ইনজেশন ভেরিফিকেশন</span>
                  </div>
                  {testStatus === "ingesting" && <Loader2 className="size-4 animate-spin" />}
                  {testStatus === "success" && <CheckCircle2 className="size-4 text-success" />}
                </div>
             </div>

             <div className="mt-auto flex gap-4">
               <Button 
                onClick={runEndToEndTest} 
                disabled={isTestRunning}
                variant={testStatus === "success" ? "outline" : "default"}
                className="rounded-full px-8"
               >
                 {isTestRunning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                 টেস্ট রান শুরু করুন
               </Button>

               {testStatus === "success" && (
                 <Button onClick={() => {
                   toast.success("অভিনন্দন! আপনার প্ল্যাটফর্ম এখন পুরোপুরি প্রস্তুত।");
                   navigate({ to: "/admin" });
                 }} className="rounded-full px-8 bg-success hover:bg-success/90">
                   ফিনিশ করুন <ArrowRight className="ml-2 size-4" />
                 </Button>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
