import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import logoAsset from "@/assets/daddy-ai-logo.png.asset.json";

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
    <main className="flex min-h-screen items-center justify-center bg-background px-5 selection:bg-primary/20">
      <div className="panel w-full max-w-sm overflow-hidden p-0 shadow-2xl animate-in">
        <div className="bg-primary/5 p-8 text-center border-b border-border/50">
          <img src={logoAsset.url} alt="Daddy AI" className="mx-auto h-16 w-auto mb-4 drop-shadow-md" />
          <h1 className="text-2xl font-bold tracking-tight">Daddy AI</h1>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold opacity-60">Admin Training Console</p>
        </div>
        
        <form onSubmit={onSubmit} className="p-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">ইমেইল</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">পাসওয়ার্ড</Label>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 shadow-sm"
              />
            </div>
          </div>

          <Button type="submit" className="mt-8 w-full h-11 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]" disabled={busy}>
            {busy ? "লগইন হচ্ছে..." : "লগইন"}
          </Button>
          
          <p className="mt-6 text-center text-xs text-muted-foreground">
            শুধু অনুমোদিত অ্যাকাউন্ট কনসোলে ঢুকতে পারবে।
          </p>
        </form>
      </div>
    </main>
  );
}