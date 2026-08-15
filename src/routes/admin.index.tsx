import { getStats } from "@/lib/console.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Database, MessageSquare, Users } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const fetchStats = useServerFn(getStats);
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats() });

  const cards = [
    { label: "কথোপকথন", value: data?.conversations, icon: Users },
    { label: "মেসেজ", value: data?.messages, icon: MessageSquare },
    { label: "অ্যাপ্রুভড ট্রেনিং জোড়া", value: data?.approved, icon: CheckCircle2 },
    { label: "পেন্ডিং রিভিউ", value: data?.pending, icon: Clock },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">ড্যাশবোর্ড</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        AI এজেন্ট কতটুকু শিখেছে তার সারসংক্ষেপ।
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="panel p-5">
            <c.icon className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : (c.value ?? 0).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link to="/admin/add" className="panel block p-5 transition-colors hover:bg-secondary/50">
          <Database className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">নতুন ডেটা যোগ করুন</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ভয়েস, টেক্সট বা JSON আপলোড — যোগ করলেই AI সঙ্গে সঙ্গে শিখে নেয়।
          </p>
        </Link>
        <Link
          to="/admin/playground"
          className="panel block p-5 transition-colors hover:bg-secondary/50"
        >
          <MessageSquare className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">এজেন্ট পরীক্ষা করুন</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            কাস্টমারের মতো প্রশ্ন করে উত্তরের মান যাচাই করুন।
          </p>
        </Link>
      </div>
    </div>
  );
}
