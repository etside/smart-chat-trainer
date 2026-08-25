import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Globe,
  KeyRound,
  Link2,
  Mic,
  MessageSquare,
  Package,
  Puzzle,
  Settings,
  ShoppingCart,
  Sparkles,
  TestTube,
  Webhook,
  Database,
  ShieldCheck,
  BarChart3,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Copy,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/tutorials")({
  component: TutorialsPage,
});

/* ─── Types ─── */
type Step = {
  title: string;
  description: string;
  code?: string;
  codeLabel?: string;
  tip?: string;
  screenshot?: string;
};

type TutorialSection = {
  id: string;
  title: string;
  icon: typeof Database;
  color: string;
  description: string;
  steps: Step[];
};

/* ─── Tutorial Data ─── */
const tutorials: TutorialSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Sparkles,
    color: "text-primary",
    description: "Account setup, dashboard overview, and first login.",
    steps: [
      {
        title: "Create Your Account",
        description:
          "Visit daddyai.online and click 'Get Started'. Sign up with your email and verify your account. You'll receive a confirmation link within seconds.",
        tip: "Use a business email for easier team management later.",
      },
      {
        title: "Complete the Setup Wizard",
        description:
          "After first login, the Setup Wizard will guide you through 4 essential steps: API key generation, webhook endpoint configuration, first training ingestion, and an end-to-end test run.",
        tip: "The wizard takes about 5 minutes. You can revisit it anytime from Dashboard > Setup Wizard.",
      },
      {
        title: "Understand the Dashboard",
        description:
          "The Dashboard shows real-time stats: total conversations, training data count, active subscribers, and recent activity. Use the sidebar to navigate to all admin features.",
      },
      {
        title: "Set Your Store Domain",
        description:
          "Go to Settings and set your store domain (e.g. wearimpressive.com). This links your AI agent to your storefront for product data, stock checks, and order placement.",
      },
    ],
  },
  {
    id: "store-connection",
    title: "Connect Your Store",
    icon: Link2,
    color: "text-blue-500",
    description: "Connect Daddy AI to your e-commerce platform (Wear Impressive, Shopify, WooCommerce).",
    steps: [
      {
        title: "Navigate to Connections",
        description:
          "From the sidebar, go to Config > Connections. This is your central hub for store integration.",
      },
      {
        title: "Enter API Endpoint",
        description:
          "Daddy AI connects to your store via a secure webhook endpoint. For Wear Impressive, the default endpoint is:\n\nhttps://api.v2.wearimpressive.com/api/ai/webhook",
        code: "POST https://api.v2.wearimpressive.com/api/ai/webhook\nContent-Type: application/json\nAuthorization: Bearer YOUR_SYNC_TOKEN",
        codeLabel: "API Endpoint",
      },
      {
        title: "Set Your Sync Token",
        description:
          "Go to Settings > API Keys and generate a sync token. Copy it and paste into the Connections page. This token authenticates all communication between Daddy AI and your store.",
        tip: "Keep your sync token secret. Never share it publicly.",
      },
      {
        title: "Test the Connection",
        description:
          "Click 'Test Connection' on the Connections page. You should see your store name, phone, currency, and timezone. This confirms the API is reachable.",
      },
      {
        title: "Sync Your Product Catalog",
        description:
          "Click 'Sync Now' to pull your entire product catalog into Daddy AI's training data. This includes product names, prices, stock levels, descriptions, and images.",
        tip: "After initial sync, set a schedule (hourly/daily/weekly) for automatic updates.",
      },
      {
        title: "Verify Stock Lookup",
        description:
          "Enter a Product ID in the Stock Lookup section on the Connections page. The response shows real-time inventory including effective stock (stock minus cart holds).",
        code: "Response: {\n  \"product_id\": 344,\n  \"name\": \"Classic Polo Shirt\",\n  \"stock\": 25,\n  \"held_quantity\": 3,\n  \"effective_stock\": 22,\n  \"status\": \"in_stock\"\n}",
        codeLabel: "Stock Lookup Response",
      },
    ],
  },
  {
    id: "facebook-instagram",
    title: "Facebook & Instagram",
    icon: Globe,
    color: "text-indigo-500",
    description: "Set up auto-reply on Facebook Messenger and Instagram DMs.",
    steps: [
      {
        title: "Create a Meta App",
        description:
          "Go to developers.facebook.com and create a new app. Select 'Business' type and add the 'Messenger' product.",
      },
      {
        title: "Get Your App Credentials",
        description:
          "Note down your App ID and App Secret. These are needed for webhook verification and message sending.",
        code: "App ID: 123456789012345\nApp Secret: abcdef1234567890abcdef1234567890",
        codeLabel: "Meta App Credentials (replace with yours)",
      },
      {
        title: "Configure Webhook URL",
        description:
          "In Meta Developer Portal, set your webhook callback URL to:\n\nhttps://daddyai.online/api/webhooks/meta\n\nUse the Verify Token from Settings > API Keys.",
        code: "Callback URL: https://daddyai.online/api/webhooks/meta\nVerify Token: YOUR_VERIFY_TOKEN\n\nSubscribe to:\n- messages\n- messaging_postbacks\n- messaging_insights",
        codeLabel: "Webhook Configuration",
        tip: "Meta will send a verification request. Daddy AI handles this automatically.",
      },
      {
        title: "Connect Your Facebook Page",
        description:
          "Go to Settings > API Keys and paste your Facebook Page Access Token. This token allows Daddy AI to send messages on behalf of your page.",
        tip: "Use a long-lived token (60 days). Set a reminder to refresh it before expiry.",
      },
      {
        title: "Enable Instagram Messaging",
        description:
          "In Meta Developer Portal, add the Instagram product to your app. Link your Instagram Business account to your Facebook Page. Daddy AI will automatically handle Instagram DMs using the same webhook.",
      },
      {
        title: "Test Auto-Reply",
        description:
          "Send a test message to your Facebook Page or Instagram DM. Daddy AI should respond within seconds based on your training data.",
        tip: "Check the Inbox page to see conversation history and AI responses in real-time.",
      },
      {
        title: "Configure Auto-Reply Rules",
        description:
          "Go to Training > Auto-Replies to set up keyword-based responses, greeting messages, and away messages. You can also configure the AI to handle product inquiries, order tracking, and returns.",
      },
    ],
  },
  {
    id: "ai-training",
    title: "AI Training",
    icon: Database,
    color: "text-green-500",
    description: "Train your AI agent with product knowledge and custom responses.",
    steps: [
      {
        title: "Understanding Training Data",
        description:
          "Daddy AI uses question-answer pairs to train your agent. Each pair has a question (what customers ask) and an answer (how your agent responds). The AI matches incoming messages to the best matching pair.",
      },
      {
        title: "Auto-Generated Pairs from Catalog",
        description:
          "When you sync your product catalog, Daddy AI automatically generates training pairs for each product: name, price, stock availability, size info, and descriptions.",
        tip: "After catalog sync, check Training Data to see auto-generated pairs. Approve the good ones.",
      },
      {
        title: "Add Custom Training Pairs",
        description:
          "Go to Training > Add Data to manually add question-answer pairs. Use this for FAQ responses, business policies, shipping info, return procedures, and custom greetings.",
        code: "Example pairs:\nQ: \"What is your return policy?\"\nA: \"We offer 7-day returns on all items. Items must be unworn with tags attached. Contact us to initiate a return.\"\n\nQ: \"Do you have COD?\"\nA: \"Yes! Cash on Delivery is available nationwide. A small delivery fee may apply.\"",
        codeLabel: "Training Pair Examples",
      },
      {
        title: "Approve and Manage Pairs",
        description:
          "Go to Training > Training Data to review all pairs. Approve good pairs, edit unclear ones, and reject incorrect ones. Only approved pairs are used by the AI.",
      },
      {
        title: "Use the Skill Builder",
        description:
          "For complex workflows (order placement, size recommendations), use Training > Skill Builder. Skills are structured conversation flows that guide customers through specific actions.",
      },
      {
        title: "Trigger Training",
        description:
          "After adding or updating training data, go to Monitor > Training Live to trigger a training run. This rebuilds the AI's knowledge index.",
        tip: "Training typically takes 2-5 minutes. You'll see real-time progress on the Training Live page.",
      },
      {
        title: "Test in Playground",
        description:
          "Go to Conversations > Playground to test your AI agent in real-time. Ask questions as a customer would and verify the responses are accurate.",
      },
    ],
  },
  {
    id: "voice-cloning",
    title: "Voice Cloning & TTS",
    icon: Volume2,
    color: "text-purple-500",
    description: "Set up voice cloning and text-to-speech for voice messages.",
    steps: [
      {
        title: "Choose a Voice Provider",
        description:
          "Daddy AI supports two TTS providers:\n\n1. Fish Audio — Industry-leading voice cloning. Upload a voice sample and the AI will clone it.\n2. MiMo — Xiaomi's TTS engine. Fast and lightweight with multiple voice options.",
        tip: "Fish Audio is recommended for brand-consistent voice. MiMo is faster and cheaper.",
      },
      {
        title: "Configure Fish Audio (Optional)",
        description:
          "Go to Config > AI / MiMo settings. Select 'Fish Audio' as your voice provider. Enter your Fish Audio API key and model/voice ID.",
        code: "Provider: Fish Audio\nAPI Key: fsk_xxxxxxxxxxxxxxxxxxxx\nModel ID: your-model-id\nVoice ID: your-voice-id",
        codeLabel: "Fish Audio Configuration",
      },
      {
        title: "Configure MiMo TTS (Optional)",
        description:
          "Select 'MiMo' as your voice provider. MiMo uses the Xiaomi speech synthesis API. No additional API key is needed if the server has it configured.",
        code: "Provider: MiMo\n(No additional API key required)",
        codeLabel: "MiMo Configuration",
      },
      {
        title: "Test Voice Playback",
        description:
          "Go to Conversations > Playground and send a test message. Click the volume icon on any AI response to hear it spoken aloud with your configured voice.",
      },
      {
        title: "Upload Voice Samples (Fish Audio)",
        description:
          "For voice cloning, upload 30-60 seconds of clean speech to Fish Audio. The clone takes about 2-5 minutes to process. Once ready, your AI agent will speak in that voice.",
        tip: "Use a quiet recording with minimal background noise. One speaker only.",
      },
    ],
  },
  {
    id: "auto-replies",
    title: "Auto-Replies & Flows",
    icon: MessageSquare,
    color: "text-amber-500",
    description: "Set up automatic responses and conversation flows.",
    steps: [
      {
        title: "Configure Greeting Message",
        description:
          "Go to Training > Auto-Replies. Set a greeting message that customers see when they first message your page. This is your AI's first impression.",
        tip: "Keep it short and inviting. Example: 'Hi! Welcome to Wear Impressive. How can I help you today?'",
      },
      {
        title: "Set Up Away Messages",
        description:
          "Configure an away message for when the AI can't answer (e.g., complex complaints). This message should let customers know you'll respond soon.",
      },
      {
        title: "Create Keyword-Based Replies",
        description:
          "Add keyword triggers for common queries. When a message contains these keywords, the AI responds with the specific reply you configured.",
        code: "Keyword: \"price\" → Response: \"Prices are shown on each product page. Would you like me to help you find something specific?\"\n\nKeyword: \"size\" → Response: \"We have sizes S, M, L, XL, XXL. Check the size chart on our website for detailed measurements.\"",
        codeLabel: "Auto-Reply Examples",
      },
      {
        title: "Build Conversation Flows",
        description:
          "Go to Conversations > Flow Builder for complex multi-step conversations. Build flows for: order placement, return requests, size recommendations, and more.",
      },
      {
        title: "Test Flows End-to-End",
        description:
          "Use the Webhook Test page to simulate incoming messages and verify your flows work correctly. Check that responses are accurate and timing is right.",
      },
    ],
  },
  {
    id: "api-webhooks",
    title: "API & Webhooks",
    icon: Webhook,
    color: "text-red-500",
    description: "Use the Daddy AI API and configure webhooks for integrations.",
    steps: [
      {
        title: "Generate API Keys",
        description:
          "Go to Config > API Keys to generate your API keys. You'll need:\n\n1. Sync Token — For store catalog sync\n2. Webhook Secret — For webhook signature verification\n3. AI API Key — For direct API access",
        tip: "Rotate your API keys regularly for security.",
      },
      {
        title: "Understand the API Endpoints",
        description:
          "Daddy AI exposes several API endpoints for integration:",
        code: "POST /api/webhooks/meta          — Facebook/Instagram webhook\nPOST /api/cron/sync              — Catalog sync trigger\nGET  /api/ai/webhook             — Wear Impressive AI endpoint\n\nAll endpoints require authentication via Bearer token or HMAC signature.",
        codeLabel: "Available API Endpoints",
      },
      {
        title: "Set Up Webhook Signature Verification",
        description:
          "Incoming webhooks are signed with HMAC-SHA256. Always verify the X-Hub-Sigma-256 header to ensure the request is from Meta.",
        code: "// Verification example\nconst crypto = require('crypto');\nconst signature = req.headers['x-hub-sigma-256'];\nconst expected = crypto\n  .createHmac('sha256', APP_SECRET)\n  .update(rawBody)\n  .digest('hex');\n\nif (signature !== expected) {\n  return res.status(401).send('Invalid signature');\n}",
        codeLabel: "Webhook Verification (Node.js)",
      },
      {
        title: "Monitor Webhook Activity",
        description:
          "Go to Logs > Event Logs to see all incoming webhook events. Use the Webhook DLQ (Dead Letter Queue) to debug failed webhook deliveries.",
      },
      {
        title: "Set Up Cron Jobs",
        description:
          "Configure automatic catalog sync and training triggers via cron. The sync endpoint can be called periodically to keep product data fresh.",
        code: "# Cron job for hourly catalog sync\n0 * * * * curl -X POST https://daddyai.online/api/cron/sync \\\n  -H 'Authorization: Bearer YOUR_SECRET' \\\n  -H 'Content-Type: application/json'",
        codeLabel: "Cron Job Example",
      },
    ],
  },
  {
    id: "storefront-integration",
    title: "Storefront Integration",
    icon: ShoppingCart,
    color: "text-teal-500",
    description: "Connect the AI chat widget to your storefront website.",
    steps: [
      {
        title: "Embed the Chat Widget",
        description:
          "Add the Daddy AI chat widget to your storefront. Copy the embed code from the Connect page and paste it before the closing </body> tag.",
        code: '<script src="https://daddyai.online/widget.js"\n  data-store="your-store-slug"\n  data-position="bottom-right"\n  data-theme="light"\n  async defer></script>',
        codeLabel: "Embed Code",
      },
      {
        title: "Configure Widget Appearance",
        description:
          "Customize the widget's colors, position, and greeting message to match your brand. Go to Settings > Branding to set primary colors, logo, and welcome text.",
      },
      {
        title: "Enable Product Cards",
        description:
          "When the AI recommends products, it can show product cards with images, prices, and direct links. This is automatically enabled when catalog sync is active.",
      },
      {
        title: "Test the Full Flow",
        description:
          "Visit your storefront, click the chat widget, and test the complete flow: ask about products, check stock, add to cart, and place an order.",
        tip: "The AI can handle the entire sales conversation without human intervention.",
      },
    ],
  },
  {
    id: "monitoring",
    title: "Monitoring & Analytics",
    icon: BarChart3,
    color: "text-cyan-500",
    description: "Track AI performance, conversations, and system health.",
    steps: [
      {
        title: "View Analytics Dashboard",
        description:
          "Go to Overview > Analytics to see conversation metrics, response times, resolution rates, and customer satisfaction scores.",
      },
      {
        title: "Monitor Real-Time Conversations",
        description:
          "Go to Conversations > Inbox to see live conversations. You can step in and take over any conversation if needed.",
      },
      {
        title: "Check Training Progress",
        description:
          "Go to Monitor > Training Live to see active training jobs and their progress. Training is triggered automatically on catalog sync or manually from here.",
      },
      {
        title: "Review Performance Metrics",
        description:
          "Go to Logs > Performance to see response latency, cache hit rates, and token usage. This helps optimize your AI's speed and cost.",
      },
      {
        title: "Audit All Actions",
        description:
          "Go to Logs > Audit Logs to see a complete history of all admin actions, API calls, and system events. Useful for compliance and debugging.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: HelpCircle,
    color: "text-orange-500",
    description: "Common issues and how to resolve them.",
    steps: [
      {
        title: "Webhook Not Receiving Events",
        description:
          "Check: 1) Verify your webhook URL is correct in Meta Developer Portal. 2) Ensure the verify token matches. 3) Check Event Logs for errors. 4) Confirm your domain has SSL enabled.",
      },
      {
        title: "AI Giving Wrong Answers",
        description:
          "Check: 1) Go to Training Data and review approved pairs. 2) Add more specific pairs for common questions. 3) Trigger a training run after changes. 4) Test in Playground.",
      },
      {
        title: "Catalog Sync Failing",
        description:
          "Check: 1) Verify API token in Connections page. 2) Test the connection first. 3) Check Event Logs for error messages. 4) Ensure your store API is reachable.",
      },
      {
        title: "Voice Not Working",
        description:
          "Check: 1) Verify TTS provider is configured in Settings > AI / MiMo. 2) Check API key is valid. 3) Test in Playground with the volume button. 4) Check browser audio permissions.",
      },
      {
        title: "Stock Data Mismatch",
        description:
          "Stock includes cart holds (items in customers' carts). Effective stock = raw stock - held quantity. Cart holds auto-expire after 15 minutes. Check Sync Status for last sync time.",
      },
      {
        title: "Messages Not Delivering",
        description:
          "Check: 1) Facebook Page Access Token may be expired. 2) Instagram Business account may need re-linking. 3) Check Logs > Event Logs for delivery errors. 4) Verify webhook subscription includes 'messages' field.",
      },
    ],
  },
];

/* ─── Component ─── */
function TutorialsPage() {
  const [activeSection, setActiveSection] = useState<string>("getting-started");
  const [expandedSteps, setExpandedSteps] = useState<Record<string, Set<number>>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<string, Set<number>>>({});

  const toggleStep = (sectionId: string, stepIndex: number) => {
    setExpandedSteps((prev) => {
      const next = { ...prev };
      if (!next[sectionId]) next[sectionId] = new Set();
      if (next[sectionId].has(stepIndex)) next[sectionId].delete(stepIndex);
      else next[sectionId].add(stepIndex);
      return next;
    });
  };

  const markComplete = (sectionId: string, stepIndex: number) => {
    setCompletedSteps((prev) => {
      const next = { ...prev };
      if (!next[sectionId]) next[sectionId] = new Set();
      if (next[sectionId].has(stepIndex)) next[sectionId].delete(stepIndex);
      else next[sectionId].add(stepIndex);
      return next;
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const active = tutorials.find((t) => t.id === activeSection)!;
  const totalSteps = tutorials.reduce((sum, t) => sum + t.steps.length, 0);
  const totalCompleted = Object.values(completedSteps).reduce((sum, set) => sum + set.size, 0);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tutorials & Documentation</h1>
            <p className="text-sm text-muted-foreground">
              Step-by-step guides to set up and master Daddy AI
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 panel p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Overall Progress
            </span>
            <span className="text-xs font-bold text-primary">
              {totalCompleted}/{totalSteps} steps completed
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${totalSteps > 0 ? (totalCompleted / totalSteps) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <nav className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-6 space-y-1">
            {tutorials.map((section) => {
              const completed = completedSteps[section.id]?.size || 0;
              const total = section.steps.length;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <section.icon className={cn("size-4 shrink-0", isActive ? "text-primary-foreground" : section.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{section.title}</p>
                    <p className={cn("text-[10px]", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {completed}/{total} steps
                    </p>
                  </div>
                  {completed === total && total > 0 && (
                    <CheckCircle2 className={cn("size-3.5 shrink-0", isActive ? "text-primary-foreground" : "text-green-500")} />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile Section Selector */}
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-20">
          <select
            value={activeSection}
            onChange={(e) => setActiveSection(e.target.value)}
            className="w-full rounded-xl border bg-background p-3 text-sm font-medium shadow-lg"
          >
            {tutorials.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Section Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("flex size-10 items-center justify-center rounded-xl bg-primary/10")}>
                <active.icon className={cn("size-5", active.color)} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{active.title}</h2>
                <p className="text-sm text-muted-foreground">{active.description}</p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {active.steps.map((step, idx) => {
              const isExpanded = expandedSteps[active.id]?.has(idx) ?? true;
              const isCompleted = completedSteps[active.id]?.has(idx) ?? false;
              return (
                <div
                  key={idx}
                  className={cn(
                    "panel overflow-hidden transition-all",
                    isCompleted && "border-green-500/30 bg-green-500/5"
                  )}
                >
                  <button
                    onClick={() => toggleStep(active.id, idx)}
                    className="w-full flex items-center gap-4 p-4 text-left"
                  >
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-xs font-bold shrink-0",
                        isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <CheckCircle2 className="size-4" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-sm", isCompleted && "line-through opacity-70")}>
                        {step.title}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "size-4 text-muted-foreground transition-transform shrink-0",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 ml-12 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {step.description}
                      </p>

                      {step.code && (
                        <div className="relative rounded-lg bg-black/90 p-4 text-xs font-mono text-green-400 overflow-x-auto">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {step.codeLabel || "Code"}
                            </span>
                            <button
                              onClick={() => copyCode(step.code!)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white transition-colors"
                            >
                              <Copy className="size-3" /> Copy
                            </button>
                          </div>
                          <pre className="whitespace-pre-wrap">{step.code}</pre>
                        </div>
                      )}

                      {step.tip && (
                        <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3">
                          <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-primary/80">{step.tip}</p>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          variant={isCompleted ? "outline" : "default"}
                          onClick={() => markComplete(active.id, idx)}
                          className="text-xs"
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="mr-1 size-3" /> Completed
                            </>
                          ) : (
                            "Mark as Done"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Section Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {(() => {
              const currentIdx = tutorials.findIndex((t) => t.id === activeSection);
              const prev = tutorials[currentIdx - 1];
              const next = tutorials[currentIdx + 1];
              return (
                <>
                  {prev ? (
                    <Button
                      variant="outline"
                      onClick={() => setActiveSection(prev.id)}
                      className="text-xs"
                    >
                      ← {prev.title}
                    </Button>
                  ) : (
                    <div />
                  )}
                  {next ? (
                    <Button
                      onClick={() => setActiveSection(next.id)}
                      className="text-xs"
                    >
                      {next.title} <ArrowRight className="ml-1 size-3" />
                    </Button>
                  ) : (
                    <div />
                  )}
                </>
              );
            })()}
          </div>

          {/* Footer Help */}
          <div className="mt-12 panel p-6 text-center">
            <HelpCircle className="mx-auto size-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Need more help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Check the FAQ page or contact support for personalized assistance.
            </p>
            <div className="flex justify-center gap-3">
              <a href="/faq" className="text-sm text-primary hover:underline flex items-center gap-1">
                FAQ <ExternalLink className="size-3" />
              </a>
              <a href="/connect" className="text-sm text-primary hover:underline flex items-center gap-1">
                AI Connect <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
