import { createFileRoute } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink, Terminal, Shield, MessageSquare, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import logoAsset from "@/assets/daddy-ai-logo.png.asset.json";

export const Route = createFileRoute('/connect')({
  component: ConnectPage,
});

function ConnectPage() {
  const [copied, setCopied] = useState(false);
  const mcpUrl = typeof window !== 'undefined' ? new URL("/mcp", window.location.origin).toString() : "";
  const appName = "Daddy AI";
  const appNameSlug = "daddy-ai-app";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const claudeCodeCommand = `claude mcp add --scope user --transport http ${appNameSlug} '${mcpUrl}'`;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Daddy AI" className="size-8 rounded-lg" />
            <span className="font-display text-xl font-bold tracking-tight">Daddy AI Connect</span>
          </div>
          <a href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Back to App
          </a>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-12 md:py-20">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-2">
            AI Integration Guide
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Connect {appName} to your AI Assistant</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Supercharge your AI with Daddy AI's training data and automation tools using the Model Context Protocol (MCP).
          </p>
        </div>

        <section className="mb-12">
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Terminal className="size-5 text-primary" />
              Your MCP Server URL
            </h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-4 bg-muted/50 rounded-xl font-mono text-sm border border-white/5 overflow-x-auto whitespace-nowrap">
                {mcpUrl}
              </code>
              <Button 
                onClick={() => copyToClipboard(mcpUrl)} 
                variant="outline" 
                size="icon"
                className="size-12 shrink-0 rounded-xl"
              >
                {copied ? <Check className="size-5 text-success" /> : <Copy className="size-5" />}
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              This URL allows AI assistants to securely communicate with your Daddy AI instance.
            </p>
          </div>
        </section>

        <div className="space-y-12">
          <h2 className="text-2xl font-bold border-b border-white/5 pb-4">Connect Steps</h2>
          
          {/* ChatGPT */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-black text-white font-bold text-sm">GPT</div>
              <h3 className="text-xl font-bold">ChatGPT</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="panel p-6 space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Plus className="size-4 text-primary" />
                  Connect
                </h4>
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                  <li>Open <a href="https://chatgpt.com/#settings/Connectors/Advanced" target="_blank" className="text-primary hover:underline">Advanced Settings</a> and enable Developer mode.</li>
                  <li>Go to the <a href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">New Connector Dialog <ExternalLink className="size-3" /></a>.</li>
                  <li>Paste "{appName}" as the name and the MCP URL from above.</li>
                  <li>Review details, check the notice, and click "Create".</li>
                  <li>Enable {appName} in the chat composer.</li>
                </ol>
              </div>
              <div className="panel p-6 space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  Refresh
                </h4>
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                  <li>Open ChatGPT's Plugins page and select {appName}.</li>
                  <li>Scroll to "Information" and click "Refresh".</li>
                  <li>If the URL changed, delete and recreate the connector.</li>
                  <li>Start a new chat to use the latest tools.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Claude */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#D97757] text-white font-bold text-sm">C</div>
              <h3 className="text-xl font-bold">Claude.ai</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="panel p-6 space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Plus className="size-4 text-primary" />
                  Connect
                </h4>
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                  <li>Open the <a href={`https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(appName)}&connectorUrl=${encodeURIComponent(mcpUrl)}`} target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">Custom Connector Dialog <ExternalLink className="size-3" /></a>.</li>
                  <li>Review the prefilled details and click "Add".</li>
                  <li>If the form is empty, manually paste the name and URL.</li>
                  <li>Enable the connector in the composer.</li>
                </ol>
              </div>
              <div className="panel p-6 space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  Refresh
                </h4>
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                  <li>Open Claude's Connectors page and select this connector.</li>
                  <li>Click "Refresh" to update the tool list.</li>
                  <li>If the URL changed, remove and re-add the connector.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Claude Code */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Terminal className="size-8 text-primary" />
              <h3 className="text-xl font-bold">Claude Code</h3>
            </div>
            <div className="panel p-8 space-y-6">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Plus className="size-4 text-primary" />
                  Install
                </h4>
                <div className="relative group">
                  <pre className="p-4 bg-muted/80 rounded-xl font-mono text-xs border border-white/5 overflow-x-auto">
                    {claudeCodeCommand}
                  </pre>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => copyToClipboard(claudeCodeCommand)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Run this in your terminal to link Daddy AI to Claude Code.</p>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verify</h5>
                  <p className="text-sm text-muted-foreground">Run <code>/mcp</code> in Claude Code to confirm connection.</p>
                </div>
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Refresh</h5>
                  <p className="text-sm text-muted-foreground italic">Start a new session to load latest tools. Run <code>claude mcp remove {appNameSlug}</code> to update the URL.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Other */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <MessageSquare className="size-8" />
              <h3 className="text-xl font-bold">Other MCP Clients</h3>
            </div>
            <div className="panel p-6">
              <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                <li>Open your client's MCP or custom connector settings.</li>
                <li>Create a remote MCP connection named "{appName}".</li>
                <li>Paste the MCP URL: <code>{mcpUrl}</code>.</li>
                <li>Reload or reconnect the server to refresh tools.</li>
              </ol>
            </div>
          </div>
        </div>

        <footer className="mt-20 pt-8 border-t border-white/5 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {appName}. Powered by Model Context Protocol.</p>
        </footer>
      </main>
    </div>
  );
}
