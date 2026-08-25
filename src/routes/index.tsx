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
  const logoUrl = "/logo.png";

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 flex flex-col">
      {/* Floating Navbar */}
      <nav className="fixed top-6 inset-x-0 z-50 mx-auto max-w-5xl px-6">
        <div className="glass rounded-full px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Daddy AI" className="h-8 w-auto" />
            <span className="font-bold text-xl tracking-tight hidden sm:block">Daddy AI</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
                Features
              </Link>
              <Link to="/connect" className="text-sm font-medium hover:text-primary transition-colors">
                Integrations
              </Link>
              <Link to="/api" className="text-sm font-medium hover:text-primary transition-colors">
                API
              </Link>
              <Link to="/faq" className="text-sm font-medium hover:text-primary transition-colors">
                FAQ
              </Link>
              <Link to="/privacy" className="text-sm font-medium hover:text-primary transition-colors">
                Legal
              </Link>
            </div>
            <Button asChild size="sm" className="rounded-full px-6 shadow-xl shadow-primary/20">
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
          
          <div className="mx-auto mt-12 max-w-2xl h-[280px] overflow-hidden relative glass border-2 border-white/20 rounded-3xl p-8 group hover:border-primary/30 transition-all duration-500 shadow-2xl delay-200">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <div className="animate-vertical-scroll space-y-8 py-4">
              {[
                { q: "Is this product in stock?", a: "Checking current inventory... Yes, we have 12 units available for immediate delivery!", icon: "🛍️", color: "from-blue-500/20" },
                { q: "এই ড্রেসটার কি আর কোনো কালার আছে?", a: "অবশ্যই! আমাদের কাছে লাল, নীল এবং কালো রঙে এটি পাওয়া যাচ্ছে।", icon: "👗", color: "from-pink-500/20" },
                { q: "How do I return my order?", a: "We offer a 30-day hassle-free return policy. Shall I start the process for you?", icon: "📦", color: "from-green-500/20" },
                { q: "অর্ডার কনফার্ম করার জন্য কি কি লাগবে?", a: "আপনার নাম, ঠিকানা এবং ফোন নম্বর দিলেই আমি অর্ডারটি কনফার্ম করে দিচ্ছি।", icon: "📝", color: "from-purple-500/20" },
                { q: "Can I get a discount for bulk?", a: "I can offer a 15% discount for orders over 10 items. Interested?", icon: "💰", color: "from-yellow-500/20" }
              ].map((item, i) => (
                <div key={i} className="space-y-4 relative">
                  <div className="flex justify-start">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl rounded-tl-none px-5 py-3 text-sm text-white/90 shadow-lg max-w-[85%] text-left transform hover:scale-[1.02] transition-transform">
                      <span className="text-xs font-black text-primary block mb-1 uppercase tracking-tighter">Customer</span>
                      {item.q}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className={`bg-gradient-to-br ${item.color} to-white/5 backdrop-blur-xl border border-primary/30 rounded-2xl rounded-tr-none px-5 py-3 text-sm text-white shadow-primary/10 shadow-xl max-w-[85%] text-left transform hover:scale-[1.02] transition-transform`}>
                      <span className="text-xs font-black text-primary block mb-1 uppercase tracking-tighter flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        Daddy AI {item.icon}
                      </span>
                      {item.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Fade effects for top/bottom */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background/80 to-transparent z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/80 to-transparent z-10" />
          </div>

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

      {/* Features Showcase */}
      <section className="py-24 px-6 lg:px-8 bg-card relative z-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Core Technology</h2>
            <p className="text-muted-foreground text-lg italic">Beyond basic chatbots — enterprise intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bento-item md:col-span-2 h-[450px] group">
              <div className="max-w-md">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Mic className="size-7 text-primary" />
                </div>
                <h3 className="text-3xl font-bold mb-4 italic">Adaptive Voice Training</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Train your agent with zero coding. Speak naturally, and our AI extracts structured sales knowledge, including complex multi-step instructions and brand nuances.
                </p>
                <Link to="/admin" className="text-primary font-bold mt-6 inline-flex items-center gap-2 hover:gap-3 transition-all">
                  Open Voice Console <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="absolute right-[-10%] bottom-[-10%] opacity-20 rotate-12 transition-transform group-hover:rotate-0">
                 <Mic className="size-64 text-primary" />
              </div>
            </div>

            <div className="bento-item h-[450px] group">
               <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="size-7 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-4 italic">Real-time Stock Sync</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Direct integration with your ERP and catalog. Your AI never suggests an out-of-stock item or an outdated price, maintaining absolute customer trust.
                </p>
                <div className="mt-8 pt-8 border-t border-white/10 w-full">
                  <div className="flex justify-between items-center text-xs font-mono text-muted-foreground mb-2">
                    <span>API SYNC</span>
                    <span className="text-success">ACTIVE</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-success w-full animate-pulse" />
                  </div>
                </div>
            </div>

            <div className="bento-item h-[450px] group">
               <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Globe className="size-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 italic">Omnichannel Presence</h3>
                <p className="text-muted-foreground leading-relaxed">
                  One single brain for your entire business. Connect to WhatsApp, Instagram, Facebook, and your Website with a unified training pipeline.
                </p>
                <div className="flex gap-4 mt-8 opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                  <MessageSquareText className="size-6" />
                  <Users className="size-6" />
                  <Globe className="size-6" />
                </div>
            </div>

            <div className="bento-item md:col-span-2 h-[450px] group">
              <div className="max-w-md">
                <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="size-7 text-accent" />
                </div>
                <h3 className="text-3xl font-bold mb-4 italic">Privacy First by Design</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Fully GDPR and CCPA compliant. Your training data is encrypted at rest and in transit, and you maintain complete ownership of your proprietary datasets.
                </p>
                <div className="flex gap-3 mt-6">
                  <span className="text-[10px] border border-success/20 bg-success/10 text-success px-2 py-1 rounded-full font-bold">GDPR COMPLIANT</span>
                  <span className="text-[10px] border border-primary/20 bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">256-BIT ENCRYPTION</span>
                </div>
              </div>
              <div className="absolute right-10 top-10 flex gap-4">
                 <div className="size-24 glass rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="size-12 text-success shadow-[0_0_20px_rgba(34,197,94,0.3)]" />
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cost Comparison Section */}
      <section className="py-32 px-6 lg:px-8 relative overflow-hidden">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Value Proposition</h2>
            <p className="text-muted-foreground text-lg">Why leading businesses switch to Daddy AI.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="glass p-10 rounded-[2.5rem] border-primary/20 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6">
                 <div className="bg-primary/20 text-primary px-4 py-1 rounded-full text-sm font-bold animate-pulse">ROI: 800%</div>
               </div>
               <h3 className="text-3xl font-bold mb-8 italic">Daddy AI Console</h3>
               <div className="space-y-6">
                 <div className="flex justify-between items-end border-b border-white/10 pb-4">
                   <span className="text-muted-foreground">Human Labor (Monthly)</span>
                   <span className="text-2xl font-bold line-through opacity-50">$4,500</span>
                 </div>
                 <div className="flex justify-between items-end border-b border-white/10 pb-4">
                   <span className="text-muted-foreground">Daddy AI (Monthly)</span>
                   <span className="text-4xl font-bold text-primary">$49</span>
                 </div>
                 <p className="text-sm text-muted-foreground italic mt-8 leading-relaxed">
                   * Based on 24/7 availability across 3 platforms, processing 5,000+ messages monthly with full inventory sync.
                 </p>
               </div>
               <div className="absolute -bottom-10 -right-10 size-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
            </div>

            <div className="space-y-8 pl-0 md:pl-12">
               <div className="flex gap-6 items-start">
                 <div className="size-12 rounded-2xl bg-success/10 flex items-center justify-center shrink-0">
                   <Zap className="size-6 text-success" />
                 </div>
                 <div>
                   <h4 className="text-xl font-bold mb-2 italic">Zero Hallucinations</h4>
                   <p className="text-muted-foreground">Unlike generic LLMs, our RAG-first approach ensures 100% price and stock accuracy.</p>
                 </div>
               </div>
               <div className="flex gap-6 items-start">
                 <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                   <Users className="size-6 text-primary" />
                 </div>
                 <div>
                   <h4 className="text-xl font-bold mb-2 italic">Infinite Scalability</h4>
                   <p className="text-muted-foreground">Handle 1 or 1,000,000 concurrent chats without increasing headcount.</p>
                 </div>
               </div>
               <div className="flex gap-6 items-start">
                 <div className="size-12 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
                   <ShieldCheck className="size-6 text-accent" />
                 </div>
                 <div>
                   <h4 className="text-xl font-bold mb-2 italic">GDPR Compliant</h4>
                   <p className="text-muted-foreground">Enterprise-grade data protection and local hosting options for complete privacy.</p>
                 </div>
               </div>
            </div>
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
          <div className="flex gap-8 text-sm text-muted-foreground flex-wrap justify-center">
             <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
             <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
             <Link to="/privacy-request" className="hover:text-primary transition-colors">GDPR Request</Link>
             <Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link>
             <Link to="/api" className="hover:text-primary transition-colors">API & White Label</Link>
             <Link to="/connect" className="hover:text-primary transition-colors">Integrations</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Daddy AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}