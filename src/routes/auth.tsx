import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "অ্যাডমিন লগইন — Wear Impressive AI Console" },
      { name: "description", content: "Wear Impressive AI ট্রেনিং কনসোলে অ্যাডমিন লগইন করুন।" },
      { property: "og:title", content: "অ্যাডমিন লগইন — Wear Impressive AI Console" },
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
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <form onSubmit={onSubmit} className="panel w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">অ্যাডমিন লগইন</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          শুধু অনুমোদিত অ্যাকাউন্ট কনসোলে ঢুকতে পারবে।
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">ইমেইল</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">পাসওয়ার্ড</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "লগইন হচ্ছে..." : "লগইন"}
        </Button>
      </form>
    </main>
  );
}
