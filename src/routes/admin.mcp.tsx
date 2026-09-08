import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import {
  Cpu,
  Copy,
  Check,
  Play,
  Loader2,
  ExternalLink,
  Wrench,
  Database,
  Brain,
  MessageSquare,
  RefreshCw,
  Download,
  Search,
  Zap,
  Globe,
  Server,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/mcp")({
  component: MCPPage,
});

const MCP_TOOLS = [
  {
    name: "search_products",
    description: "Search the product catalogue by keyword. Returns matching products with images, prices, stock, and order links.",
    icon: Search,
    params: [
      { name: "query", type: "string", required: true, desc: "Product name, category, or keyword" },
      { name: "limit", type: "number", required: false, desc: "Max results (1-10, default 5)" },
      { name: "in_stock_only", type: "boolean", required: false, desc: "Only return in-stock products" },
    ],
  },
  {
    name: "get_training_stats",
    description: "Get current training statistics: total pairs, approved/pending counts, confidence score, last sync time.",
    icon: Brain,
    params: [],
  },
  {
    name: "add_training_pair",
    description: "Add a new training Q&A pair to improve the agent. Auto-approved.",
    icon: Database,
    params: [
      { name: "question", type: "string", required: true, desc: "Customer question" },
      { name: "answer", type: "string", required: true, desc: "Agent answer" },
      { name: "language", type: "string", required: false, desc: "bn or en (default bn)" },
    ],
  },
  {
    name: "trigger_sync",
    description: "Trigger a catalog sync to refresh products, prices, and stock.",
    icon: RefreshCw,
    params: [],
  },
  {
    name: "get_conversations",
    description: "Get recent conversations for analysis.",
    icon: MessageSquare,
    params: [
      { name: "limit", type: "number", required: false, desc: "Number of conversations (1-20)" },
      { name: "source", type: "string", required: false, desc: "Filter by source" },
    ],
  },
  {
    name: "auto_train",
    description: "Run one auto-training cycle: analyze conversations, generate new Q&A pairs.",
    icon: Zap,
    params: [
      { name: "max_pairs", type: "number", required: false, desc: "Max pairs to generate (default 20)" },
    ],
  },
  {
    name: "get_backup",
    description: "Returns the latest backup bundle URL or generates one on demand.",
    icon: Download,
    params: [
      { name: "generate", type: "boolean", required: false, desc: "Generate a fresh backup" },
    ],
  },
];

const META_MCP_TOOLS = [
  { name: "meta_debug_token", description: "Inspect token validity, expiration, and scopes" },
  { name: "meta_exchange_token", description: "Exchange short-lived token for long-lived (~60 days)" },
  { name: "meta_refresh_token", description: "Refresh a long-lived token before expiration" },
  { name: "meta_get_page_token", description: "Get Page Access Token from user token" },
  { name: "meta_subscribe_webhook", description: "Subscribe webhook to page messages" },
  { name: "meta_get_app_info", description: "Get Meta App information" },
  { name: "meta_update_token", description: "Update the stored access token" },
];

const FB_MCP_TOOLS = [
  { name: "fb_get_page_feed", description: "Get page posts/feed" },
  { name: "fb_get_page_insights", description: "Get page analytics" },
  { name: "fb_get_comments", description: "Get comments on a post" },
  { name: "fb_create_post", description: "Create a new post" },
  { name: "fb_reply_comment", description: "Reply to a comment" },
  { name: "fb_delete_post", description: "Delete a post" },
  { name: "fb_get_conversations", description: "Get Messenger conversations" },
  { name: "fb_send_message", description: "Send a Messenger message" },
];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Copied!");
      }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}

function MCPPage() {
  const mcpUrl = "https://daddyai.online/mcp";
  const metaMcpUrl = "https://daddyai.online/api/public/meta-mcp";
  const fbMcpUrl = "https://daddyai.online/api/public/facebook-mcp";

  const [testTool, setTestTool] = useState<string | null>(null);
  const [testArgs, setTestArgs] = useState("{}");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<"main" | "meta" | "facebook">("main");

  async function runToolTest() {
    if (!testTool) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      let args = {};
      try { args = JSON.parse(testArgs); } catch { toast.error("Invalid JSON args"); setTestLoading(false); return; }

      const endpoint = activeEndpoint === "main" ? mcpUrl : activeEndpoint === "meta" ? metaMcpUrl : fbMcpUrl;

      if (activeEndpoint === "main") {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/call",
            params: { name: testTool, arguments: args },
            id: 1,
          }),
        });
        const data = await res.json();
        setTestResult(JSON.stringify(data.result?.content?.[0]?.text || data, null, 2));
      } else {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: testTool, arguments: args }),
        });
        const data = await res.json();
        setTestResult(JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  }

  const tools = activeEndpoint === "main" ? MCP_TOOLS : activeEndpoint === "meta" ? META_MCP_TOOLS : FB_MCP_TOOLS;

  const claudeConfig = `{
  "mcpServers": {
    "daddy-ai": {
      "url": "${mcpUrl}",
      "transport": "http"
    }
  }
}`;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Cpu className="size-8 text-primary" /> MCP Server
        </h1>
        <p className="mt-2 text-muted-foreground">
          Model Context Protocol server — connect AI assistants (Claude, Cursor, etc.) to DaddyAI's tools and data.
        </p>
      </div>

      {/* Endpoint Selector */}
      <div className="flex gap-2">
        {([
          { key: "main", label: "DaddyAI MCP", icon: Server, url: mcpUrl },
          { key: "meta", label: "Meta MCP", icon: Globe, url: metaMcpUrl },
          { key: "facebook", label: "Facebook MCP", icon: Globe, url: fbMcpUrl },
        ] as const).map(({ key, label, icon: Icon, url }) => (
          <button
            key={key}
            onClick={() => { setActiveEndpoint(key); setTestTool(null); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeEndpoint === key
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card border border-white/5 hover:bg-card/80"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Connection Info */}
      <div className="panel p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Server className="size-5 text-primary" />
          Connection Endpoint
        </h2>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 font-mono text-sm">
          <span className="flex-1 truncate">{activeEndpoint === "main" ? mcpUrl : activeEndpoint === "meta" ? metaMcpUrl : fbMcpUrl}</span>
          <CopyBtn text={activeEndpoint === "main" ? mcpUrl : activeEndpoint === "meta" ? metaMcpUrl : fbMcpUrl} />
        </div>

        {activeEndpoint === "main" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-card border border-white/5">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Protocol</p>
              <p className="text-sm">MCP 2025-03-26 (Streamable HTTP)</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-white/5">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Server Name</p>
              <p className="text-sm">daddy-ai-mcp v1.0.0</p>
            </div>
          </div>
        )}
      </div>

      {/* Claude Desktop Config */}
      {activeEndpoint === "main" && (
        <div className="panel p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            Claude Desktop Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Add this to your <code className="font-mono bg-muted px-1.5 py-0.5 rounded">claude_desktop_config.json</code>:
          </p>
          <div className="relative">
            <pre className="p-4 rounded-xl bg-muted/50 text-xs font-mono overflow-x-auto">{claudeConfig}</pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(claudeConfig);
                toast.success("Config copied!");
              }}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 hover:bg-background transition-colors"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ExternalLink className="size-3" />
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener" className="hover:text-primary transition-colors">
              Learn more about MCP
            </a>
          </div>
        </div>
      )}

      {/* Tools List + Tester */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tools List */}
        <div className="panel p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="size-5 text-primary" />
            Available Tools ({tools.length})
          </h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {tools.map((tool) => (
              <button
                key={tool.name}
                onClick={() => {
                  setTestTool(tool.name);
                  setTestResult(null);
                  if ("params" in tool && tool.params.length > 0) {
                    const defaults: Record<string, any> = {};
                    tool.params.forEach((p: any) => {
                      if (p.required) defaults[p.name] = p.type === "string" ? "" : p.type === "number" ? 1 : true;
                    });
                    setTestArgs(JSON.stringify(defaults, null, 2));
                  } else {
                    setTestArgs("{}");
                  }
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  testTool === tool.name
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-white/5 hover:border-primary/30 hover:bg-card/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {"icon" in tool && tool.icon ? <tool.icon className="size-4 text-primary" /> : <Wrench className="size-4 text-muted-foreground" />}
                  <span className="font-mono text-sm font-bold">{tool.name}</span>
                  {testTool === tool.name && <Badge variant="default" className="text-[9px] ml-auto">SELECTED</Badge>}
                </div>
                <p className="text-xs text-muted-foreground ml-6">{tool.description}</p>
                {"params" in tool && tool.params.length > 0 && (
                  <div className="mt-2 ml-6 flex flex-wrap gap-1">
                    {tool.params.map((p: any) => (
                      <span key={p.name} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${p.required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {p.name}{p.required ? "*" : ""}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tool Tester */}
        <div className="panel p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Play className="size-5 text-primary" />
            Tool Tester
          </h2>

          {testTool ? (
            <>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="font-mono text-sm font-bold">{testTool}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tools.find((t) => t.name === testTool)?.description}
                </p>
              </div>

              <div>
                <Label className="text-xs font-bold">Arguments (JSON)</Label>
                <Textarea
                  value={testArgs}
                  onChange={(e) => setTestArgs(e.target.value)}
                  rows={4}
                  className="mt-1 font-mono text-sm"
                  placeholder='{"query": "panjabi"}'
                />
              </div>

              <Button onClick={runToolTest} disabled={testLoading} className="w-full">
                {testLoading ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Running...</>
                ) : (
                  <><Play className="size-4 mr-2" /> Run Tool</>
                )}
              </Button>

              {testResult && (
                <div>
                  <Label className="text-xs font-bold">Result</Label>
                  <pre className="mt-1 p-4 rounded-xl bg-muted/50 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(testResult), null, 2); }
                      catch { return testResult; }
                    })()}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Wrench className="size-12 mb-4 opacity-20" />
              <p className="text-sm">Select a tool from the list to test it</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="panel p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => {
              setActiveEndpoint("main");
              setTestTool("get_training_stats");
              setTestArgs("{}");
              setTestResult(null);
            }}
          >
            <Brain className="size-4 mr-2 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Training Stats</p>
              <p className="text-[10px] text-muted-foreground">Check training data health</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => {
              setActiveEndpoint("main");
              setTestTool("search_products");
              setTestArgs(JSON.stringify({ query: "panjabi", limit: 3 }, null, 2));
              setTestResult(null);
            }}
          >
            <Search className="size-4 mr-2 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Search Products</p>
              <p className="text-[10px] text-muted-foreground">Test product search</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => {
              setActiveEndpoint("meta");
              setTestTool("meta_debug_token");
              setTestArgs("{}");
              setTestResult(null);
            }}
          >
            <Globe className="size-4 mr-2 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Check Meta Token</p>
              <p className="text-[10px] text-muted-foreground">Verify Meta API token</p>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
