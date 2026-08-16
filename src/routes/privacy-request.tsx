import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Mail, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/privacy-request")({
  component: PrivacyRequestPage,
});

function PrivacyRequestPage() {
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"export" | "deletion">("export");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setStatus("submitted");
    toast.success("আপনার অনুরোধটি গৃহীত হয়েছে। আমরা শীঘ্রই ইমেইলে জানাবো।");
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-xl mx-auto glass p-8 rounded-[2rem]">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <ShieldCheck className="text-primary" /> 
          GDPR Privacy Request
        </h1>
        <p className="text-muted-foreground mb-8">আপনার তথ্যের নিরাপত্তা নিশ্চিত করতে আপনার ডেটা এক্সপোর্ট বা ডিলিট করার জন্য এই ফর্মটি পূরণ করুন।</p>
        
        {status === "submitted" ? (
            <div className="p-6 bg-success/10 border border-success/20 rounded-xl text-center">
                <ShieldCheck className="size-12 text-success mx-auto mb-4" />
                <h2 className="text-xl font-bold text-success mb-2">অনুরোধ গৃহীত হয়েছে!</h2>
                <p className="text-muted-foreground">আপনার অনুরোধটি প্রসেস করা হচ্ছে। আমরা আপনার ইমেইলে আপডেট জানাবো।</p>
            </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>আপনার ইমেইল</Label>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
          </div>
          
          <div className="space-y-3">
            <Label>অনুরোধের ধরন</Label>
            <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setType("export")} className={`p-4 rounded-xl border ${type === "export" ? "border-primary bg-primary/10" : "border-border"}`}>
                    ডেটা এক্সপোর্ট
                </button>
                <button type="button" onClick={() => setType("deletion")} className={`p-4 rounded-xl border ${type === "deletion" ? "border-primary bg-primary/10" : "border-border"}`}>
                    ডেটা ডিলিট
                </button>
            </div>
          </div>

          {type === "deletion" && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                <AlertTriangle className="size-6 shrink-0" />
                <p>সতর্কতা: ডেটা ডিলিট করলে আপনার সকল ট্রেনিং ডেটা এবং কনভারসেশন চিরতরে মুছে যাবে। এটি আর রিকভার করা সম্ভব নয়।</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={status === "submitting"}>
            {status === "submitting" ? "প্রসেসিং..." : "অনুরোধ জমা দিন"}
          </Button>
        </form>
        )}
      </div>
    </div>
  );
}
