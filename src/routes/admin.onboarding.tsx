import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Webhook, CheckCircle2, ArrowRight, ShieldCheck, Database } from "lucide-react";

export const Route = createFileRoute("/admin/onboarding")({
  component: OnboardingWizard,
});

function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const next = () => setStep(s => s + 1);

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold italic mb-2">Setup <span className="text-primary">Daddy AI</span></h1>
        <p className="text-muted-foreground">৩টি ধাপে আপনার সেলস এজেন্ট প্রস্তুত করুন</p>
      </div>

      <div className="relative mb-8">
        <div className="flex justify-between relative z-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`size-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step >= s ? "bg-primary border-primary text-white" : "bg-card border-border text-muted-foreground"}`}>
              {step > s ? <CheckCircle2 className="size-6" /> : s}
            </div>
          ))}
        </div>
        <div className="absolute top-5 left-0 w-full h-0.5 bg-border -z-0">
          <div className="h-full bg-primary transition-all" style={{ width: `${(step - 1) * 50}%` }} />
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
               সবকিছু ঠিক আছে কি না যাচাই করতে একটি টেস্ট ট্রেনিং রিকুয়েস্ট পাঠান। এটি সফল হলে আপনার ড্যাশবোর্ড সক্রিয় হবে।
             </p>
             <div className="mt-auto">
               <Button onClick={() => {
                 toast.success("অভিনন্দন! আপনার প্ল্যাটফর্ম এখন প্রস্তুত।");
                 navigate({ to: "/admin" });
               }} className="rounded-full px-8 bg-success hover:bg-success/90">ইনজেশন ভেরিফাই করুন <ArrowRight className="ml-2 size-4" /></Button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
