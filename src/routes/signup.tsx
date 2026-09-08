import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, ArrowRight, Check, Loader2, Building2, Mail, Phone, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up — DaddyAI" },
      { name: "description", content: "Create your DaddyAI account and start automating customer replies on Messenger, Instagram & WhatsApp." },
    ],
  }),
  component: SignupPage,
});

const plans = [
  { id: "free", name: "Free", price: "৳0/mo", desc: "100 sessions · 1 platform", color: "border-border" },
  { id: "starter", name: "Starter", price: "৳1,499/mo", desc: "1K sessions · 3 platforms · Vision AI", color: "border-primary", badge: "Popular" },
  { id: "pro", name: "Pro", price: "৳3,499/mo", desc: "5K sessions · All platforms · Training pipeline", color: "border-primary/50" },
];

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("starter");

  const [form, setForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  function update(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    if (step === 2) { setStep(3); return; }

    // Step 3 — create account
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);

    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { business_name: form.businessName, phone: form.phone } },
      });
      if (authErr) throw authErr;

      // 2. Create tenant + subscription via server fn
      const slug = slugify(form.businessName) || `tenant-${Date.now()}`;
      const res = await fetch('/api/saas/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.businessName,
          email: form.email,
          phone: form.phone,
          slug,
          plan: selectedPlan,
          user_id: authData.user?.id,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Failed to create account');

      toast.success("Account created! Welcome to DaddyAI!");
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err.message ?? "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Noise texture */}
      <div className="noise" />

      {/* Green radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(32,216,120,0.1),transparent_35%)]" />

      {/* Ambient blob */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />

      {/* Theme toggle */}
      <ThemeToggle className="absolute top-4 right-4 z-50" />

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/80 border-b borderprimary/12">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="flex size-7 items-center justify-center rounded-xl bg-primary text-[#031006] shadow-sm shadow-primary/30">
              <Bot className="size-3.5" strokeWidth={2.5} />
            </span>
            <span className="font-bold text-base text-foreground">
              Daddy<span className="text-primary">AI</span>
            </span>
          </Link>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Already have an account?{" "}
            <span className="text-primary font-medium">Sign in</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-12 relative z-10">
        <div className="w-full max-w-lg">
          {/* Progress steps */}
          <div className="mb-8 flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  s < step
                    ? 'bg-primary/20 text-primary'
                    : s === step
                      ? 'bg-primary text-[#031006]'
                      : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {s < step ? <Check className="size-3.5" /> : s}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${
                  s === step ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {s === 1 ? 'Plan' : s === 2 ? 'Business' : 'Account'}
                </span>
                {s < 3 && (
                  <div className={`flex-1 h-px ${
                    s < step ? 'bg-primary/40' : 'bgprimary/12'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-3xl border borderprimary/20 bg-card backdrop-blur-xl p-8 shadow-xl shadow-black/30 dark:shadow-black/60">
              <form onSubmit={onSubmit} className="space-y-5">

                {/* Step 1 — Plan selection */}
                {step === 1 && (
                  <>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Choose your plan</h2>
                      <p className="text-sm text-muted-foreground mt-1">Start free, upgrade anytime. No credit card needed.</p>
                    </div>
                    <div className="space-y-3">
                      {plans.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPlan(p.id)}
                          className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                            selectedPlan === p.id
                              ? 'border-primary bg-primary/5'
                              : 'borderprimary/15 hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{p.name}</span>
                                {p.badge && (
                                  <span className="text-[10px] bg-primary text-[#031006] px-2 py-0.5 rounded-full font-bold">
                                    {p.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-sm text-foreground">{p.price}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-full h-11 font-semibold bg-primary text-[#031006] hover:bg-primary/90"
                    >
                      Continue <ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </>
                )}

                {/* Step 2 — Business info */}
                {step === 2 && (
                  <>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Your business</h2>
                      <p className="text-sm text-muted-foreground mt-1">Tell us about your business.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="bname" className="text-foreground">Business / Shop name</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="bname"
                            placeholder="e.g. Wear Impressive"
                            value={form.businessName}
                            onChange={e => update('businessName', e.target.value)}
                            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary/50"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-foreground">Email address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@yourshop.com"
                            value={form.email}
                            onChange={e => update('email', e.target.value)}
                            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary/50"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-foreground">Phone (optional)</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="01XXXXXXXXX"
                            value={form.phone}
                            onChange={e => update('phone', e.target.value)}
                            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary/50"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 rounded-full h-11 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                        onClick={() => setStep(1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 rounded-full h-11 font-semibold bg-primary text-[#031006] hover:bg-primary/90"
                      >
                        Continue <ArrowRight className="ml-1.5 size-4" />
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3 — Account password */}
                {step === 3 && (
                  <>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Set a password for{" "}
                        <span className="text-foreground font-medium">{form.email}</span>
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="pw" className="text-foreground">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="pw"
                            type="password"
                            placeholder="Min 8 characters"
                            value={form.password}
                            onChange={e => update('password', e.target.value)}
                            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary/50"
                            required
                            minLength={8}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cpw" className="text-foreground">Confirm password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="cpw"
                            type="password"
                            placeholder="Repeat password"
                            value={form.confirmPassword}
                            onChange={e => update('confirmPassword', e.target.value)}
                            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary/50"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 rounded-full h-11 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                        onClick={() => setStep(2)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 rounded-full h-11 font-semibold bg-primary text-[#031006] hover:bg-primary/90"
                        disabled={busy}
                      >
                        {busy
                          ? <><Loader2 className="size-4 animate-spin mr-2" /> Creating...</>
                          : <>Create account <ArrowRight className="ml-1.5 size-4" /></>
                        }
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      By signing up you agree to our{" "}
                      <Link to="/terms" className="text-primary hover:underline">Terms</Link>
                      {" "}and{" "}
                      <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </p>
                  </>
                )}

              </form>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
