import { getStats, exportTrainingData } from "@/lib/console.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Database, MessageSquare, Users, Download, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const fetchStats = useServerFn(getStats);
  const exportData = useServerFn(exportTrainingData);
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats() });

  const handleExport = async (type: "training_pairs" | "conversations") => {
    try {
      const res = await exportData({ data: { type } });
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("এক্সপোর্ট সফল হয়েছে");
    } catch {
      toast.error("এক্সপোর্ট করা যায়নি");
    }
  };

  const cards = [
    { label: "কথোপকথন", value: data?.conversations, icon: Users },
    { label: "মেসেজ", value: data?.messages, icon: MessageSquare },
    { label: "অ্যাপ্রুভড ট্রেনিং জোড়া", value: data?.approved, icon: CheckCircle2 },
    { label: "পেন্ডিং রিভিউ", value: data?.pending, icon: Clock },
    { label: "AI ক্রেডিট ব্যবহার", value: data?.creditUsage?.toFixed(2), icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">ড্যাশবোর্ড</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                                        
                                            
                                            Add a webhook test panel so I can send a sample voice/message payload and immediately verify transcription, training triggers, and the stored response logs.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="panel p-5">
            <c.icon className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : c.value}
            </p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <Link
          to="/admin/progress"
          className="panel block p-5 transition-colors hover:bg-secondary/50"
        >
          <Activity className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">ট্রেনিং প্রগ্রেস</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            অটোমেটিক ট্রেনিং জব এবং স্ট্যাটাস দেখুন।
          </p>
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">ডেটা এক্সপোর্ট</h2>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => handleExport("training_pairs")}>
            <Download className="mr-2 h-4 w-4" /> ট্রেনিং জোড়া এক্সপোর্ট
          </Button>
          <Button variant="outline" onClick={() => handleExport("conversations")}>
            <Download className="mr-2 h-4 w-4" /> কথোপকথন এক্সপোর্ট
          </Button>
        </div>
      </div>
    </div>
  );
}
