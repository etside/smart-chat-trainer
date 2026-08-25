import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Code2, Globe, Shield, Zap, Copy, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/api")({
  head: () => ({
    meta: [
      { title: "API & White Label — Daddy AI" },
      { name: "description", content: "Daddy AI API documentation and white-label partnership program." },
    ],
  }),
  component: APIPage,
});

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function APIPage() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-4">
          <Link to="/" className="text-primary hover:underline text-sm inline-block">← Back to Home</Link>
          <h1 className="text-4xl md:text-5xl font-bold italic">API & White Label</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Build on top of Daddy AI's training infrastructure, or resell it under your own brand.
          </p>
        </div>

        {/* REST API Section */}
        <section className="glass p-8 md:p-12 rounded-[2rem] space-y-8">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Code2 className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">REST API</h2>
              <p className="text-sm text-muted-foreground">Manage training data, conversations, and analytics programmatically.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold mb-2">Authentication</h3>
              <p className="text-muted-foreground text-sm mb-3">
                All API requests require a Bearer token. Generate API keys from your dashboard.
              </p>
              <div className="bg-card rounded-xl p-4 font-mono text-sm border border-border/40">
                <span className="text-muted-foreground">Authorization:</span> Bearer <span className="text-primary">your_api_key</span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2">Base URL</h3>
              <div className="bg-card rounded-xl p-4 font-mono text-sm border border-border/40 flex items-center justify-between">
                <span>{baseUrl}/api/v1</span>
                <CopyButton text={`${baseUrl}/api/v1`} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3">Endpoints</h3>
              <div className="space-y-3">
                {[
                  { method: "GET", path: "/training-pairs", desc: "List all training data pairs" },
                  { method: "POST", path: "/training-pairs", desc: "Create a new training pair" },
                  { method: "GET", path: "/conversations", desc: "List conversation histories" },
                  { method: "GET", path: "/analytics", desc: "Usage and performance analytics" },
                  { method: "POST", path: "/sync", desc: "Trigger inventory sync" },
                  { method: "POST", path: "/webhook/test", desc: "Send a test webhook" },
                ].map((ep, i) => (
                  <div key={i} className="bg-card rounded-xl p-4 border border-border/40 flex items-center gap-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      ep.method === "GET" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                    }`}>
                      {ep.method}
                    </span>
                    <code className="text-sm font-mono flex-1">{ep.path}</code>
                    <span className="text-sm text-muted-foreground hidden md:block">{ep.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2">Example Request</h3>
              <div className="bg-card rounded-xl p-4 font-mono text-xs border border-border/40 overflow-x-auto">
                <pre>{`curl -X GET ${baseUrl}/api/v1/training-pairs \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}</pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2">Rate Limits</h3>
              <p className="text-muted-foreground text-sm">
                Default: 60 requests/minute per API key. Configurable per key. Token caps can be set to control usage.
              </p>
            </div>
          </div>
        </section>

        {/* White Label Section */}
        <section className="glass p-8 md:p-12 rounded-[2rem] space-y-8 border-2 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Globe className="size-6 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">White Label Program</h2>
              <p className="text-sm text-muted-foreground">Resell Daddy AI under your own brand.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: <Globe className="size-5 text-primary" />,
                title: "Your Brand, Your Domain",
                desc: "Custom-branded dashboard with your logo, colors, and domain. Your clients never see the Daddy AI brand.",
              },
              {
                icon: <Shield className="size-5 text-success" />,
                title: "Isolated Infrastructure",
                desc: "Each white-label partner gets isolated data storage and API endpoints. Complete separation from other tenants.",
              },
              {
                icon: <Zap className="size-5 text-accent" />,
                title: "Full API Access",
                desc: "Access all features programmatically — training management, conversation analytics, webhook integration, and more.",
              },
              {
                icon: <Code2 className="size-5 text-primary" />,
                title: "SDK & Integrations",
                desc: "Native SDKs for JavaScript, Python, and Go. Pre-built integrations for popular platforms and CRMs.",
              },
            ].map((feature, i) => (
              <div key={i} className="bg-card rounded-xl p-6 border border-border/40 space-y-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {feature.icon}
                </div>
                <h3 className="font-bold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl p-6 border border-border/40 space-y-4">
            <h3 className="font-bold text-lg">White Label Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { plan: "Starter", price: "$199/mo", features: ["Up to 10 clients", "Custom branding", "API access", "Email support"] },
                { plan: "Business", price: "$499/mo", features: ["Up to 50 clients", "Custom domain", "Priority support", "Advanced analytics"] },
                { plan: "Enterprise", price: "Custom", features: ["Unlimited clients", "Dedicated infra", "SLA guarantee", "Account manager"] },
              ].map((tier, i) => (
                <div key={i} className={`rounded-xl p-5 border ${i === 1 ? "border-primary/40 bg-primary/5" : "border-border/40"}`}>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{tier.plan}</p>
                  <p className="text-2xl font-bold mt-1">{tier.price}</p>
                  <ul className="mt-4 space-y-2">
                    {tier.features.map((f, j) => (
                      <li key={j} className="text-sm text-muted-foreground flex items-center gap-2">
                        <Check className="size-3 text-primary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Interested in a white-label partnership?</p>
            <Button asChild size="lg" className="rounded-full">
              <Link to="/auth">Apply for Partnership</Link>
            </Button>
          </div>
        </section>

        {/* MCP Integration Section */}
        <section className="glass p-8 md:p-12 rounded-[2rem] space-y-6">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-success/10 flex items-center justify-center">
              <Zap className="size-6 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">MCP Integration</h2>
              <p className="text-sm text-muted-foreground">Connect your AI tools directly to Daddy AI.</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Daddy AI supports the Model Context Protocol (MCP), allowing AI assistants like ChatGPT,
            Claude, and Claude Code to interact with your training data. Manage training pairs, run analytics,
            and check sync status through natural language.
          </p>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/connect">View MCP Integration Guide →</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
