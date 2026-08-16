import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Mic, MessageSquareText, Sparkles, ArrowRight, Zap, ShieldCheck, Globe, Star, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daddy AI — Next-Gen AI Sales Training" },
      {
        name: "description",
        content:
          "Daddy AI provides a premium, voice-first training console for your AI sales agents. Learn from chats, sync inventory, and deploy everywhere.",
      },
      { property: "og:title", content: "Daddy AI — Advanced AI Training" },
      {
        property: "og:description",
        content: "Build smarter AI sales agents with voice training and automated catalog sync.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const logoUrl = "/__l5e/assets-v1/16ae758b-43b8-4811-bf07-1fb7fe1d6698/daddy-ai-logo.png";

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 flex flex-col">
      {/* Floating Navbar */}
      <nav className="fixed top-6 inset-x-0 z-50 mx-auto max-w-5xl px-6">
        <div className="glass rounded-full px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Daddy AI" className="h-8 w-auto" />
            <span className="font-bold text-xl tracking-tight hidden sm:block">Daddy AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </Link>
            <Button asChild size="sm" className="rounded-full px-6">
              <Link to={session ? "/admin" : "/auth"}>
                {session ? "Dashboard" : "Get Started"}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-24 overflow-hidden mesh-bg">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <div className="flex justify-center mb-8 animate-in">
             <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20 backdrop-blur-sm">
                <Star className="size-3 fill-primary" />
                <span>Trusted by 500+ impressive businesses</span>
             </div>
          </div>

          <h1 className="animate-in text-6xl font-extrabold tracking-tight text-foreground sm:text-8xl lg:text-9xl delay-100">
            Daddy <span className="text-primary italic">AI</span>
          </h1>
          
          <p className="mt-8 animate-in text-xl leading-relaxed text-muted-foreground max-w-3xl mx-auto delay-200">
            Elevate your customer service with the most human-like AI agents. 
            Trained on your data, syncs with your stock, and speaks your brand language perfectly.
          </p>

          <div className="mt-12 flex animate-in items-center justify-center gap-x-6 delay-300">
            <Button asChild size="lg" className="h-14 px-10 text-lg rounded-full shadow-2xl shadow-primary/30 transition-all hover:scale-105">
              <Link to={session ? "/admin" : "/auth"}>
                {loading ? "Loading..." : session ? "Enter Console" : "Start Training Now"}
              </Link>
            </Button>
          </div>

          {/* Abstract Preview */}
          <div className="mt-20 relative animate-in delay-500">
             <div className="glass rounded-3xl p-4 shadow-2xl max-w-4xl mx-auto border-t border-white/20">
                <div className="bg-card rounded-2xl overflow-hidden shadow-inner flex aspect-[16/9]">
                   <aside className="w-1/4 border-r border-border/40 p-6 hidden md:block text-left">
                      <div className="space-y-6">
                         <div className="h-2 w-full bg-muted rounded-full" />
                         <div className="h-2 w-3/4 bg-muted rounded-full" />
                         <div className="h-2 w-5/6 bg-muted rounded-full" />
                         <div className="h-2 w-1/2 bg-muted rounded-full" />
                      </div>
                   </aside>
                   <main className="flex-1 p-8 flex flex-col">
                      <div className="flex-1 flex flex-col justify-end space-y-4">
                         <div className="bg-muted w-2/3 h-12 rounded-2xl rounded-bl-none animate-pulse" />
                         <div className="bg-primary/10 w-1/2 h-10 rounded-2xl rounded-br-none self-end" />
                         <div className="bg-muted w-3/4 h-16 rounded-2xl rounded-bl-none animate-pulse" />
                      </div>
                      <div className="mt-8 flex gap-4">
                         <div className="flex-1 h-12 bg-muted rounded-full" />
                         <div className="size-12 bg-primary rounded-full" />
                      </div>
                   </main>
                </div>
             </div>
             <Sparkles className="absolute -top-10 -right-10 size-20 text-accent/20 animate-pulse" />
             <div className="absolute -bottom-20 -left-20 size-64 bg-primary/20 blur-[100px] rounded-full" />
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-24 px-6 lg:px-8 bg-card relative z-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bento-item md:col-span-2 h-[400px]">
              <div className="max-w-md">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Mic className="size-7 text-primary" />
                </div>
                <h3 className="text-3xl font-bold mb-4">Voice-to-Training</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Train your agent by just speaking. Our high-fidelity transcription converts your voice into structured Q&A pairs instantly.
                </p>
              </div>
              <div className="absolute right-[-10%] bottom-[-10%] opacity-20 rotate-12">
                 <Mic className="size-64 text-primary" />
              </div>
            </div>

            <div className="bento-item h-[400px]">
               <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                  <Zap className="size-7 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Auto-Sync Engine</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Real-time synchronization with your product catalog, stocks, and inventory across all channels.
                </p>
            </div>

            <div className="bento-item h-[400px]">
               <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Globe className="size-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Multi-Platform</h3>
                <p className="text-muted-foreground leading-relaxed">
                  One agent, everywhere. Connect to Messenger, WhatsApp, and Telegram with a single API key.
                </p>
            </div>

            <div className="bento-item md:col-span-2 h-[400px]">
              <div className="max-w-md">
                <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                  <ShieldCheck className="size-7 text-accent" />
                </div>
                <h3 className="text-3xl font-bold mb-4">Enterprise Guardrails</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Built-in safety layers ensure your AI stays on brand, never hallucinates prices, and protects user data.
                </p>
              </div>
              <div className="absolute right-10 top-10 flex gap-4">
                 <div className="size-20 glass rounded-full flex items-center justify-center animate-bounce">
                    <ShieldCheck className="size-10 text-success" />
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 border-y border-border/40">
         <div className="mx-auto max-w-7xl px-6 text-center">
            <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
               <div className="flex items-center gap-2 text-2xl font-bold">Impressive</div>
               <div className="flex items-center gap-2 text-2xl font-bold">Usenodi.ai</div>
               <div className="flex items-center gap-2 text-2xl font-bold">ElevenLabs</div>
               <div className="flex items-center gap-2 text-2xl font-bold">RetailNext</div>
            </div>
         </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
         <div className="mx-auto max-w-5xl px-6">
            <div className="glass rounded-[3rem] p-12 md:p-24 text-center relative z-10">
               <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to train your <span className="text-primary italic">Daddy</span>?</h2>
               <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                  Join hundreds of businesses scaling their sales with automated intelligence.
               </p>
               <Button asChild size="lg" className="h-16 px-12 text-xl rounded-full">
                  <Link to="/auth">Get Started for Free</Link>
               </Button>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-primary/20 blur-[150px] -z-10 rounded-full" />
         </div>
      </section>

      <footer className="mt-auto border-t border-border/40 py-12 px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Daddy AI" className="h-6 w-auto" />
            <span className="font-bold text-lg tracking-tight">Daddy AI</span>
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
             <a href="#" className="hover:text-primary transition-colors">Privacy</a>
             <a href="#" className="hover:text-primary transition-colors">Terms</a>
             <a href="#" className="hover:text-primary transition-colors">Documentation</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Daddy AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}