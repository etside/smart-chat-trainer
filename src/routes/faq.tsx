import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Daddy AI" },
      { name: "description", content: "Frequently asked questions about Daddy AI's voice-first sales training platform." },
    ],
  }),
  component: FAQPage,
});

const faqData = [
  {
    q: "What is Daddy AI?",
    a: "Daddy AI is a voice-first AI sales training platform. It lets you train AI sales agents using natural conversation — just speak, and the system extracts structured sales knowledge including product details, pricing, policies, and brand nuances.",
  },
  {
    q: "How does voice training work?",
    a: "Open the Voice Console, click record, and speak naturally about your products, services, or sales scripts. The AI transcribes your voice, extracts key information, and structures it into training pairs. You can review and approve each pair before it enters the training pipeline.",
  },
  {
    q: "Which platforms can I connect to?",
    a: "Daddy AI supports omnichannel deployment. You can connect your trained AI agent to WhatsApp, Instagram, Facebook Messenger, and your website chat. All channels share the same unified training data.",
  },
  {
    q: "Is my training data private?",
    a: "Yes. Your data is encrypted at rest and in transit (256-bit AES). We are fully GDPR and CCPA compliant. Your training data is never used to train other customers' agents and you retain full ownership at all times.",
  },
  {
    q: "What is the API and how do I use it?",
    a: "Daddy AI provides a REST API that lets you integrate AI training capabilities into your own applications. You can manage training data, trigger syncs, and query analytics programmatically. See our API documentation on the Connect page for full details.",
  },
  {
    q: "What is white-label reselling?",
    a: "Our white-label program lets you resell Daddy AI's capabilities under your own brand. You get a custom-branded dashboard, your own API endpoints, and support for onboarding your own clients. Contact us for partnership details.",
  },
  {
    q: "What is the MCP integration?",
    a: "MCP (Model Context Protocol) allows AI tools like ChatGPT, Claude, and Claude Code to directly interact with your Daddy AI account. You can manage training data, run queries, and check analytics through natural language in your preferred AI assistant.",
  },
  {
    q: "How does inventory sync work?",
    a: "Daddy AI connects to your ERP or catalog system via API. It keeps your AI agent's knowledge up to date with real-time stock levels, pricing, and product availability — so the agent never recommends an out-of-stock item.",
  },
  {
    q: "What are API keys and how do I manage them?",
    a: "API keys authenticate your API requests. Create keys from the API Keys section of the dashboard. Each key has configurable rate limits and token caps. Keys are shown once at creation for security — store them safely.",
  },
  {
    q: "What are the pricing plans?",
    a: "Daddy AI starts at $49/month for the standard plan, which includes 5,000+ message processing, omnichannel support, and real-time inventory sync. Enterprise and white-label plans are available on request.",
  },
  {
    q: "Can I export my training data?",
    a: "Yes. You can export all your training data, conversation histories, and analytics from the dashboard. Full data portability is a core feature.",
  },
  {
    q: "How do I get support?",
    a: "Use the Support button in the dashboard to submit a ticket. Enterprise customers get priority support with dedicated account managers.",
  },
];

function FAQItem({ item }: { item: (typeof faqData)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-lg font-bold text-foreground pr-4">{item.q}</span>
        {open ? (
          <ChevronUp className="size-5 shrink-0 text-primary" />
        ) : (
          <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="pb-5 text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
          {item.a}
        </div>
      )}
    </div>
  );
}

function FAQPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-3xl mx-auto glass p-8 md:p-12 rounded-[2rem]">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-4 italic">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mb-10">
          Everything you need to know about Daddy AI's voice-first sales training platform.
        </p>

        <div className="divide-y divide-border/40">
          {faqData.map((item, i) => (
            <FAQItem key={i} item={item} />
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border/40 text-center space-y-4">
          <p className="text-muted-foreground">Still have questions?</p>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/auth">Get Started</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
