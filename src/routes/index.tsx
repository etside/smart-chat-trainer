import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, KeyRound, Mic, MessageSquareText, Sparkles, ArrowRight, Zap, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/daddy-ai-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daddy AI — Advanced Sales Agent Training" },
      {
        name: "description",
        content:
          "Daddy AI-এর সেলস এজেন্ট ট্রেনিং কনসোল — চ্যাট ডেটা দিয়ে ট্রেন করুন, ভয়েস দিয়ে নতুন ডেটা যোগ করুন, যেকোনো প্ল্যাটফর্মে কানেক্ট করুন।",
      },
      { property: "og:title", content: "Daddy AI Console" },
      {
        property: "og:description",
        content: "চ্যাট ডেটা দিয়ে ট্রেন করা AI সেলস এজেন্ট — ভয়েস ট্রেনিং ও API কানেকশন সহ।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: MessageSquareText, title: "আসল চ্যাট থেকে শেখা", text: "১.২ লাখ+ পুরোনো মেসেজ থেকে তৈরি ট্রেনিং ডেটা।" },
  { icon: Mic, title: "ভয়েস দিয়ে ট্রেনিং", text: "ভয়েস রেকর্ড করলেই transcribe হয়ে ট্রেনিং জোড়া তৈরি হয়।" },
  { icon: KeyRound, title: "যেকোনো প্ল্যাটফর্মে", text: "API key দিয়ে Messenger, WhatsApp বা ওয়েবসাইটে যুক্ত করুন।" },
];

function Landing() {
  const { session, loading } = useAuth();

  return (
    <main className="min-h-screen bg-background selection:bg-primary/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/40 bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center sm:py-32 lg:px-8">
          <div className="flex animate-in items-center gap-3 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
            <Sparkles className="size-4" />
            <span>Next-Gen AI Sales Training</span>
          </div>

          <div className="mt-10 flex animate-in justify-center delay-100">
            <img src={logoAsset.url} alt="Daddy AI Logo" className="h-32 w-auto drop-shadow-2xl" />
          </div>

          <h1 className="mt-8 animate-in text-5xl font-bold tracking-tight text-foreground sm:text-7xl delay-200">
            Daddy AI
          </h1>
          
          <p className="mt-6 animate-in text-lg leading-8 text-muted-foreground sm:max-w-2xl delay-300">
            আপনার পেজের স্টাইল আর কাস্টমার কথোপকথন থেকে শিখে নিজেই দক্ষ সেলস এজেন্ট হয়ে ওঠে। 
            ভয়েস ট্রেনিং এবং রিয়েল-টাইম সিঙ্ক সহ সব প্লাটফর্মে কানেক্ট করুন আজই।
          </p>

          <div className="mt-10 flex animate-in items-center justify-center gap-x-6 delay-400">
            <Button asChild size="lg" className="h-12 px-8 text-base shadow-xl shadow-primary/20">
              <Link to={session ? "/admin" : "/auth"}>
                {loading ? "লোড হচ্ছে..." : session ? "কনসোলে প্রবেশ করুন" : "শুরু করুন"}
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Link to="/auth" className="text-sm font-semibold leading-6 text-foreground hover:text-primary transition-colors">
              কীভাবে কাজ করে <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        
        {/* Background Mesh Decor */}
        <div className="absolute top-0 -z-10 h-full w-full opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 h-[500px] w-[500px] bg-primary blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] bg-accent blur-[120px]" />
        </div>
      </div>

      {/* Bento Grid Features */}
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary">Advanced Capabilities</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            সবকিছু এক জায়গায়
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          <div className="panel panel-hover flex flex-col justify-between p-8">
            <div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <MessageSquareText className="size-6 text-primary" />
              </div>
              <h3 className="mt-6 text-xl font-bold">আসল চ্যাট থেকে লার্নিং</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                ১.২ লাখেরও বেশি গতানুগতিক মেসেজ থেকে AI শিখেছে আপনার ব্র্যান্ডের নিজস্ব কথা বলার ধরন।
              </p>
            </div>
          </div>

          <div className="panel panel-hover flex flex-col justify-between p-8">
            <div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10">
                <Mic className="size-6 text-accent" />
              </div>
              <h3 className="mt-6 text-xl font-bold">ইন্সট্যান্ট ভয়েস ট্রেনিং</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                সরাসরি ভয়েস রেকর্ড করুন। Daddy AI নিজে থেকেই সেটাকে ট্রান্সক্রাইব করে ট্রেনিং সেটে যুক্ত করে নেয়।
              </p>
            </div>
          </div>

          <div className="panel panel-hover flex flex-col justify-between p-8">
            <div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Zap className="size-6 text-primary" />
              </div>
              <h3 className="mt-6 text-xl font-bold">অটোমেটিক ইনভেন্টরি সিঙ্ক</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                আপনার প্রোডাক্ট ক্যাটালগ এবং স্টকের সাথে রিয়েল-টাইম সিঙ্ক থাকে, ফলে ভুল তথ্য দেওয়ার ভয় নেই।
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Section */}
      <div className="bg-card py-24 sm:py-32 border-t border-border/40">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-x-8 gap-y-16 lg:grid-cols-2">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                নিরাপদ এবং বিশ্বস্ত
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                আমরা আপনার ডেটা সিকিউরিটি এবং প্রাইভেসি নিশ্চিত করি। 
                এন্ড-টু-এন্ড এনক্রিপশন এবং সিকিউর API ম্যানেজমেন্টের মাধ্যমে আপনার বিজনেস ডেটা থাকে নিরাপদ।
              </p>
              <div className="mt-10 flex items-center gap-x-6">
                <div className="flex items-center gap-x-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="size-5 text-success" />
                  Enterprise Grade Security
                </div>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
               <div className="panel p-2 shadow-2xl rotate-3">
                  <div className="bg-muted rounded-lg overflow-hidden border border-border">
                     <div className="h-1 w-full bg-primary" />
                     <div className="p-8 space-y-4">
                        <div className="flex gap-2 items-center">
                           <div className="size-8 rounded-full bg-primary/20" />
                           <div className="h-2 w-24 bg-muted-foreground/20 rounded" />
                        </div>
                        <div className="space-y-2">
                           <div className="h-2 w-full bg-muted-foreground/10 rounded" />
                           <div className="h-2 w-5/6 bg-muted-foreground/10 rounded" />
                        </div>
                        <div className="flex justify-end">
                           <div className="bg-primary/10 p-4 rounded-2xl rounded-tr-none text-xs text-primary font-medium">
                              "Daddy AI: আপনার সকল প্রোডাক্ট এখন স্টকে আছে!"
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-border/40 py-12 px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src={logoAsset.url} alt="Daddy AI" className="h-6 w-auto" />
            <span className="font-bold text-lg">Daddy AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Daddy AI. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
