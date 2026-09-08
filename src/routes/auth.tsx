import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import logoAsset from "@/assets/daddy-ai-logo.png.asset.json";
import { motion } from "framer-motion";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "লগইন — Daddy AI Console" },
      { name: "description", content: "Daddy AI ট্রেনিং কনসোলে অ্যাডমিন লগইন করুন।" },
      { property: "og:title", content: "লগইন — Daddy AI Console" },
      { property: "og:description", content: "ট্রেনিং কনসোলে প্রবেশ করতে লগইন করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

// Framer Motion variants — card enters from below, form fields stagger
const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,
             transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};
const fieldVariants = {
  hidden: { opacity: 0, y: 14 },
  show:   (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.08 },
  }),
};

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("লগইন ব্যর্থ: " + error.message);
      return;
    }
    toast.success("স্বাগতম!");
    navigate({ to: "/admin" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center
                     bg-background px-5 selection:bg-primary/20
                     relative overflow-hidden mesh-bg">
      <div className="noise" />

      {/* Ambient green glow — decorative, behind card */}
      <div className="pointer-events-none absolute inset-0
                      bg-[radial-gradient(circle_at_60%_40%,hsl(var(--primary)/0.08),transparent_40%)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/4
                      h-64 w-64 rounded-full blur-[100px] opacity-15
                      bg-[hsl(var(--primary)/0.5)]" />

      <ThemeToggle className="absolute top-4 right-4 z-10" />

      {/* Card — Framer Motion entrance */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm overflow-hidden rounded-3xl
                   border borderprimary/20
                   bg-card shadow-2xl backdrop-blur-xl
                   relative z-10"
      >
        {/* Header */}
        <div className="bg-primary/5 p-8 text-center border-b border-border/40">
          <motion.img
            src={logoAsset.url}
            alt="Daddy AI"
            className="mx-auto h-14 w-auto mb-4 drop-shadow-md"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Daddy AI</h1>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold opacity-60">
            Admin Training Console
          </p>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-8">
          <div className="space-y-4">
            <motion.div className="space-y-2" variants={fieldVariants} custom={0} initial="hidden" animate="show">
              <Label htmlFor="email" className="text-foreground font-medium">ইমেইল</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-background border-border text-foreground
                           placeholder:text-muted-foreground/60
                           focus-visible:ring-primary focus-visible:border-primary/50"
              />
            </motion.div>

            <motion.div className="space-y-2" variants={fieldVariants} custom={1} initial="hidden" animate="show">
              <Label htmlFor="password" className="text-foreground font-medium">পাসওয়ার্ড</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-background border-border text-foreground
                           placeholder:text-muted-foreground/60
                           focus-visible:ring-primary focus-visible:border-primary/50"
              />
            </motion.div>

            <motion.div variants={fieldVariants} custom={2} initial="hidden" animate="show" className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!email) { toast.error("ইমেইল লিখুন"); return; }
                  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth" });
                  if (error) toast.error(error.message);
                  else toast.success("পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে");
                }}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </button>
            </motion.div>
          </div>

          <motion.div
            variants={fieldVariants} custom={3} initial="hidden" animate="show"
            className="mt-8"
          >
            <Button
              type="submit"
              className="w-full h-11 text-base font-bold
                         bg-primary text-[hsl(var(--background))]
                         hover:bg-primary/90 shadow-[0_0_28px_color-mix(in srgb, var(--primary) 30%, transparent)]
                         transition-all duration-200 hover:scale-[1.02] active:scale-[.98]"
              disabled={busy}
            >
              {busy ? "লগইন হচ্ছে..." : "লগইন"}
            </Button>
          </motion.div>

          <motion.p
            variants={fieldVariants} custom={4} initial="hidden" animate="show"
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            অ্যাকাউন্ট নেই?{" "}
            <Link to="/signup" className="text-primary hover:text-primary/80 font-semibold transition-colors">
              Create account
            </Link>
          </motion.p>
        </form>
      </motion.div>
    </main>
  );
}
