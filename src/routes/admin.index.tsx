import { getStats, exportTrainingData } from "@/lib/console.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Database, MessageSquare, Users, Download, Activity, Terminal, PlusCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

// ── Framer Motion variants ────────────────────────────────────────────────
// Signature pattern: staggered card entrances + hover lift
// One motion vocabulary used consistently across all grids
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};
const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};
const terminalVariants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const, delay: 0.1 } },
};

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
      toast.success("এক্সপোর্ট সফল হয়েছে");
    } catch {
      toast.error("এক্সপোর্ট করা যায়নি");
    }
  };

  const cards = [
    { label: 'কথোপকথন',                value: data?.conversations,              icon: Users,        color: 'text-blue-400' },
    { label: 'মেসেজ',                   value: data?.messages,                   icon: MessageSquare, color: 'text-violet-400' },
    { label: 'অ্যাক্টিভ সেশন (24h)',     value: data?.activeSessions,             icon: Activity,     color: 'text-emerald-400' },
    { label: 'হট লিড',              value: data?.hotLeads,                   icon: Activity,     color: 'text-red-400' },
    { label: 'ওয়ার্ম লিড',           value: data?.warmLeads,                  icon: Activity,     color: 'text-amber-400' },
    { label: 'কোল্ড লিড',            value: data?.coldLeads,                  icon: Activity,     color: 'text-cyan-400' },
    { label: 'VIP কাস্টমার',            value: data?.vipCustomers,               icon: Users,        color: 'text-yellow-400' },
    { label: 'পেন্ডিং এস্কেলেশন',       value: data?.pendingEscalations,         icon: AlertTriangle, color: 'text-orange-400' },
    { label: 'অ্যাপ্রুভড ট্রেনিং',       value: data?.approved,                   icon: CheckCircle2, color: 'text-green-400' },
    { label: 'AI ক্রেডিট ব্যবহার',       value: data?.creditUsage?.toFixed(2),    icon: Activity,     color: 'text-pink-400' },
  ];

  const actions = [
    { to: "/admin/add",          icon: Database,      title: "নতুন ডেটা যোগ করুন",    desc: "ভয়েস, টেক্সট বা JSON আপলোড — যোগ করলেই AI সঙ্গে সঙ্গে শিখে নেয়।",              highlight: false },
    { to: "/admin/playground",   icon: MessageSquare, title: "এজেন্ট পরীক্ষা করুন",    desc: "কাস্টমারের মতো প্রশ্ন করে উত্তরের মান যাচাই করুন।",                           highlight: false },
    { to: "/admin/sync",         icon: Activity,      title: "প্রোডাক্ট সিঙ্ক",        desc: "ইনভেন্টরি এবং প্রোডাক্ট ডেটা অটোমেটিক সিঙ্ক ম্যানেজ করুন।",                   highlight: true  },
    { to: "/admin/webhook-test", icon: Terminal,      title: "ওয়েবহুক টেস্ট প্যানেল",  desc: "ভয়েস বা টেক্সট পাঠিয়ে AI রেসপন্স এবং লগ যাচাই করুন।",                       highlight: false },
    { to: "/admin/progress",     icon: Activity,      title: "ট্রেনিং প্রগ্রেস",        desc: "অটোমেটিক ট্রেনিং জব এবং স্ট্যাটাস দেখুন।",                                      highlight: false },
    { to: "/admin/onboarding",   icon: PlusCircle,    title: "অনবোর্ডিং উইজার্ড",       desc: "নতুন প্ল্যাটফর্ম কানেক্ট করার গাইডলাইন এবং সেটআপ।",                           highlight: true  },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">

      {/* Header */}
      <motion.div variants={headerVariants} initial="hidden" animate="show">
        <h1 className="text-3xl font-bold tracking-tight
                       bg-gradient-to-r from-primary to-[#20d878]
                       bg-clip-text text-transparent">
          ড্যাশবোর্ড
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Daddy AI কনসোল — সিস্টেম স্ট্যাটাস ও অ্যাক্টিভিটি
        </p>
      </motion.div>

      {/* Terminal block — theme-aware, not hardcoded black */}
      <motion.div
        variants={terminalVariants} initial="hidden" animate="show"
        className="overflow-hidden rounded-xl border border-border/40
                   bg-card/95 shadow-xl font-mono group relative"
      >
        <div className="flex items-center justify-between px-4 py-2
                        border-b border-border/30 bg-muted/30">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-500/60" />
            <div className="size-2.5 rounded-full bg-amber-500/60" />
            <div className="size-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <div className="text-[9px] uppercase tracking-tighter text-muted-foreground font-sans font-bold">
            System Status: Active
          </div>
        </div>
        <div className="p-4 text-[11px] leading-relaxed text-primary/80 whitespace-pre-wrap">
          <span className="text-primary">$</span> daddy-ai --status check-sync{"\n"}
          {/* Use muted-foreground instead of white/40 — visible in both themes */}
          <span className="text-muted-foreground">
            {"{"}&quot;status&quot;:&quot;ok&quot;,&quot;sync&quot;:&quot;active&quot;,&quot;ai&quot;:&quot;connected&quot;,&quot;db&quot;:&quot;connected&quot;{"}"}
          </span>{"\n"}
          <span className="text-primary">$</span> daddy-ai --version{"\n"}
          <span className="text-muted-foreground">Daddy AI v1.0.0 (self-hosted)</span>
        </div>
      </motion.div>

      {/* Stats Cards — staggered entrance */}
      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {cards.map((c) => (
          <motion.div
            key={c.label}
            variants={cardVariants}
            whileHover={{ y: -4, boxShadow: "0 12px 32px color-mix(in srgb, var(--primary) 10%, transparent)" }}
            className="bg-card border border-border rounded-2xl p-5 cursor-default"
          >
            <div className="bg-primary/10 rounded-xl p-2.5 w-fit mb-3">
              <c.icon className={cn('size-4', c.color ?? 'text-primary')} />
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {isLoading ? "—" : (c.value ?? "—")}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{c.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions Grid — same stagger vocabulary */}
      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {actions.map((a) => (
          <motion.div key={a.to} variants={cardVariants}>
            <Link
              to={a.to}
              className={`block rounded-2xl p-5 h-full
                          border transition-all duration-200 group
                          hover:border-primary/35
                          hover:shadow-[0_8px_28px_color-mix(in_srgb,var(--primary)_10%,transparent)]
                          ${a.highlight
                            ? "bg-primary/5 border-primary/20"
                            : "bg-card border-border"}`}
            >
              <div className={`rounded-xl p-2.5 text-primary w-fit mb-3
                               transition-colors duration-200
                               ${a.highlight
                                 ? "bg-primary/10 group-hover:bg-primary/20"
                                 : "bg-primary/10 group-hover:bg-primary/15"}`}>
                <a.icon className="size-4" />
              </div>
              <h2 className="font-semibold text-sm text-foreground">{a.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Data Export */}
      <motion.div
        variants={cardVariants} initial="hidden" animate="show"
        className="bg-card border border-border rounded-2xl p-6"
      >
        <h2 className="text-base font-semibold mb-1 text-foreground">ডেটা এক্সপোর্ট</h2>
        <p className="text-xs text-muted-foreground mb-4">ট্রেনিং ডেটা JSON ফরম্যাটে ডাউনলোড করুন।</p>
        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-primary text-[hsl(var(--background))] hover:bg-primary/90 font-bold
                       shadow-[0_0_22px_color-mix(in srgb, var(--primary) 25%, transparent)]"
            onClick={() => handleExport("training_pairs")}
          >
            <Download className="mr-2 h-4 w-4" /> ট্রেনিং জোড়া এক্সপোর্ট
          </Button>
          <Button
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/5 font-semibold"
            onClick={() => handleExport("conversations")}
          >
            <Download className="mr-2 h-4 w-4" /> কথোপকথন এক্সপোর্ট
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
