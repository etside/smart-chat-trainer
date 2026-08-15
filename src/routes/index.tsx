import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, KeyRound, Mic, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wear Impressive AI Console — Sales Agent Training" },
      {
        name: "description",
        content:
          "Wear Impressive-এর AI সেলস এজেন্ট ট্রেনিং কনসোল — চ্যাট ডেটা দিয়ে ট্রেন করুন, ভয়েস দিয়ে নতুন ডেটা যোগ করুন, যেকোনো প্ল্যাটফর্মে কানেক্ট করুন।",
      },
      { property: "og:title", content: "Wear Impressive AI Console" },
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
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-16">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Bot className="size-3.5" /> Wear Impressive AI
        </div>

        <h1 className="mt-6 text-4xl font-semibold sm:text-5xl">
          আপনার পেজের মতো করেই উত্তর দেয় — এমন একটা AI এজেন্ট
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          পুরোনো কথোপকথন দিয়ে ট্রেন করা, নতুন ডেটা ও ভয়েস মেসেজ দিয়ে আরও শেখানো যায়, আর API দিয়ে
          অন্য প্ল্যাটফর্মে কানেক্ট করা যায়।
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to={session ? "/admin" : "/auth"}>
              {loading ? "লোড হচ্ছে..." : session ? "কনসোলে যান" : "অ্যাডমিন লগইন"}
            </Link>
          </Button>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="panel p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
