import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PinGuard } from "@/components/PinGuard";
import { amIAdmin, getMyRole } from "@/lib/console.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DaddyAILogo } from "@/components/icons";
import {
  Activity,
  AlertTriangle,
  Code2,
  Database,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  PlusCircle,
  Settings,
  Terminal,
  BarChart3,
  ShieldCheck,
  Server,
  MessageSquare,
  BookOpen,
  Menu,
  X,
  Wand2,
  Sparkles,
  GitBranch,
  Crown,
  Cpu,
  Mic,
  Fingerprint,
  ChevronDown,
  Lock,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "কনসোল — Daddy AI" },
      { name: "description", content: "Daddy AI সেলস এজেন্ট ট্রেনিং কনসোল।" },
      { property: "og:title", content: "কনসোল — Daddy AI" },
      { property: "og:description", content: "Daddy AI সেলস এজেন্ট ট্রেনিং কনসোল।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof Database;
  exact?: boolean;
  minRole?: "admin" | "editor" | "moderator" | "viewer";
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Dashboard & Analytics",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, minRole: "editor" },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3, minRole: "editor" },
      { to: "/admin/usage", label: "Usage", icon: BarChart3, minRole: "admin" },
      { to: "/admin/onboarding", label: "Setup Wizard", icon: PlusCircle, minRole: "admin" },
    ],
  },
  {
    title: "Training",
    items: [
      { to: "/admin/training", label: "Training Data", icon: Database, minRole: "editor" },
      { to: "/admin/add", label: "Add Data", icon: PlusCircle, minRole: "editor" },
      { to: "/admin/skill-builder", label: "Skill Builder", icon: Wand2, minRole: "editor" },
      { to: "/admin/canned-responses", label: "Templates", icon: MessageSquare, minRole: "moderator" },
      { to: "/admin/auto-replies", label: "Auto-Replies", icon: MessageSquare, minRole: "moderator" },
    ],
  },
  {
    title: "Conversations",
    items: [
      { to: "/admin/inbox", label: "Inbox", icon: MessagesSquare, minRole: "moderator" },
      { to: "/admin/playground", label: "Playground", icon: MessagesSquare, minRole: "editor" },
      { to: "/admin/flow-builder", label: "Flow Builder", icon: Wand2, minRole: "editor" },
    ],
  },
  {
    title: "Responsiveness",
    items: [
      { to: "/admin/responsiveness", label: "Overview", icon: Activity, minRole: "editor" },
    ],
  },
  {
    title: "Monitor",
    items: [
      { to: "/admin/sync", label: "Sync Status", icon: Activity, minRole: "editor" },
      { to: "/admin/progress", label: "Training Live", icon: Activity, minRole: "editor" },
      { to: "/admin/escalation", label: "Escalation Queue", icon: AlertTriangle, minRole: "admin" },
      { to: "/admin/webhook-test", label: "Webhook Test", icon: Terminal, minRole: "admin" },
    ],
  },
  {
    title: "Logs & Performance",
    items: [
      { to: "/admin/audit-logs", label: "Audit Logs", icon: History, minRole: "admin" },
      { to: "/admin/logs", label: "Event Logs", icon: History, minRole: "admin" },
      { to: "/admin/performance", label: "Performance", icon: Activity, minRole: "admin" },
      { to: "/admin/webhook-dlq", label: "Webhook DLQ", icon: Terminal, minRole: "admin" },
    ],
  },
  {
    title: "Config",
    items: [
      { to: "/admin/settings", label: "Settings", icon: Settings, minRole: "admin" },
      { to: "/admin/settings/mimo", label: "MIMO Settings", icon: Cpu, minRole: "admin" },
      { to: "/admin/voice", label: "Voice Clones", icon: Mic, minRole: "moderator" },
      { to: "/admin/api-hub", label: "API Hub", icon: Cpu, minRole: "admin" },
      { to: "/admin/mcp", label: "MCP Server", icon: Server, minRole: "admin" },
      { to: "/admin/api-keys", label: "API Keys", icon: KeyRound, minRole: "admin" },
      { to: "/admin/credentials", label: "Platform Credentials", icon: Fingerprint, minRole: "admin" },
      { to: "/admin/connections", label: "Connections", icon: Code2, minRole: "admin" },
      { to: "/admin/tutorials", label: "Tutorials", icon: BookOpen, minRole: "editor" },
      { to: "/admin/backup", label: "Backup & Restore", icon: Database, minRole: "admin" },
    ],
  },
  {
    title: "External & SaaS",
    items: [
      { to: "/connect", label: "AI Connect", icon: Terminal, minRole: "editor" },
      { to: "/api", label: "API & White Label", icon: Code2, minRole: "admin" },
      { to: "/faq", label: "FAQ", icon: MessageSquare, minRole: "editor" },
      { to: "/knowledge-base", label: "Knowledge Base", icon: MessageSquare, minRole: "editor" },
      { to: "/admin/tenants", label: "Tenants", icon: Crown, minRole: "admin" },
      { to: "/admin/readiness", label: "Readiness", icon: ShieldCheck, minRole: "admin" },
    ],
  },
  {
    title: "Legal",
    items: [
      { to: "/privacy", label: "Privacy Policy", icon: ShieldCheck, minRole: "viewer" },
      { to: "/terms", label: "Terms of Service", icon: ShieldCheck, minRole: "viewer" },
      { to: "/privacy-request", label: "GDPR Request", icon: History, minRole: "viewer" },
    ],
  },
];

// ── Mermaid Flow Diagram Modal ───────────────────────────────────────────────

const MERMAID_DIAGRAM = `
flowchart TD
    A([Customer Message]) --> B{Channel}
    B --> |Facebook| C[Meta Webhook]
    B --> |WhatsApp| C
    B --> |Instagram| C

    C --> D[Parse Message
extractMessageContent]
    D --> E{Has Image?}

    E --> |Yes| F[Vision AI
Analyze image]
    F --> F2{Vision Failback}
    F2 --> |chat.b.ai OK| F3[Parse JSON
color, fabric, style, etc]
    F2 --> |Bytez timeout/empty| F4[Graceful fallback
summary = temporarily unavailable]
    F3 --> G[Match Products
from catalogue]
    F4 --> G
    G --> H[Add vision context
to message]
    E --> |No| H

    H --> I[Calculate Priority
priority.server]
    I --> J{Priority Score}
    J --> |90 plus - VIP| K[Skip auto-reply
Escalate to human]
    J --> |70 plus - High| L[Mark HIGH
Generate draft]
    J --> |Normal| M[Normal flow]

    L --> N[Generate AI Reply
agent.server]
    M --> N

    N --> O{Auto-Reply Mode}
    O --> |on| P[Send via Meta API
Delivers immediately]
    O --> |off or standby| Q[Store as DRAFT
Admin must approve]

    Q --> R[Admin Inbox
Review and approve]
    R --> |Approve and Send| P
    R --> |Edit| Q

    P --> S[Log Conversation
session_messages]
    S --> T[Training Pipeline
Extract LEAD and SOLD]
    T --> U[Canned Responses
auto_reply_templates]
    U --> V[Auto-Reply Engine
Rule matching and AB test]
    V --> |Next message| N

    T --> TA[Auto-Training Cron
Hourly /api/public/cron/auto-train]
    TA --> TB{Deadline Gate}
    TB --> |≤30s AI call| TC[Generate Q&A pairs
from unanswered topics + products]
    TB --> |429 storm / time-out| TD[Bail with deadline
return 0 pairs, try next hour]
    TC --> TE[Insert approved pairs
update confidence score]
    TE --> U

    S --> W[Log Performance
analytics.server]
    W --> X[Nightly Cron
Update template scores]
    X --> U

    P --> Y([Customer receives reply])

    style A fill:#6366f1,color:#fff,stroke:none
    style Y fill:#22c55e,color:#fff,stroke:none
    style K fill:#ef4444,color:#fff,stroke:none
    style L fill:#68f044,color:#fff,stroke:none
    style M fill:#22c55e,color:#fff,stroke:none
    style Q fill:#f59e0b,color:#fff,stroke:none
    style F fill:#8b5cf6,color:#fff,stroke:none
    style R fill:#0ea5e9,color:#fff,stroke:none
`;

function MermaidModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const renderDiagram = async () => {
      try {
        // Load mermaid from CDN if not already loaded
        if (!(window as any).mermaid) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Mermaid"));
            document.head.appendChild(script);
          });
        }

        const mermaid = (window as any).mermaid;
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "base",
          themeVariables: isDark ? {
            primaryColor: "#6366f1",
            primaryTextColor: "#fff",
            primaryBorderColor: "#4f46e5",
            lineColor: "#6366f1",
            secondaryColor: "#1e1b4b",
            tertiaryColor: "#0f172a",
            background: "#0f172a",
            mainBkg: "#1e1b4b",
            nodeBorder: "#4f46e5",
            clusterBkg: "#1e293b",
            titleColor: "#a5b4fc",
            edgeLabelBackground: "#1e1b4b",
            fontFamily: "Inter, system-ui, sans-serif",
          } : {
            primaryColor: "#6366f1",
            primaryTextColor: "#fff",
            primaryBorderColor: "#4f46e5",
            lineColor: "#4f46e5",
            secondaryColor: "#eef2ff",
            tertiaryColor: "#f8fafc",
            background: "#ffffff",
            mainBkg: "#eef2ff",
            nodeBorder: "#a5b4fc",
            clusterBkg: "#f1f5f9",
            titleColor: "#3730a3",
            edgeLabelBackground: "#ffffff",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        });

        if (containerRef.current) {
          const id = "mermaid-flow-" + Date.now();
          const { svg } = await mermaid.render(id, MERMAID_DIAGRAM.trim());
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to render diagram");
      }
    };

    renderDiagram();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-[var(--mermaid-panel,#0f172a)] border border-[var(--mermaid-border,#4f46e5)] rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--mermaid-border,#4f46e5)] shrink-0">
          <div className="flex items-center gap-3">
            <GitBranch className="size-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-foreground">Project Flow</h2>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">DaddyAI Message Pipeline</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Diagram */}
        <div className="flex-1 overflow-auto p-6">
          {error ? (
            <div className="text-destructive text-sm p-4 bg-destructive/10 rounded-xl">{error}</div>
          ) : !rendered ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <svg className="animate-spin size-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading diagram…</span>
            </div>
          ) : null}
          <div ref={containerRef} className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto" />
        </div>
      </div>
    </div>
  );
}

function AdminLayout() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchMyRole = useServerFn(getMyRole);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMermaid, setShowMermaid] = useState(false);

  const roleQuery = useQuery({
    queryKey: ["my-role", session?.user.id],
    queryFn: () => fetchMyRole(),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || (session && roleQuery.isLoading)) {
    return <div className="p-10 text-sm text-muted-foreground">লোড হচ্ছে...</div>;
  }

  const userRole = roleQuery.data?.role || "user";
  const roles = ["user", "viewer", "moderator", "editor", "admin"];
  const userRoleIndex = roles.indexOf(userRole);

  if (session && userRole === "user") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-sm text-muted-foreground">এই অ্যাকাউন্টের কনসোল অ্যাক্সেস নেই।</p>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          লগআউট
        </Button>
      </div>
    );
  }

  return (
    <PinGuard>
    <div className="flex min-h-screen bg-background selection:bg-primary/20 noise-overlay overflow-hidden mesh-bg transition-colors duration-500">
      {/* 2-Column Responsive Layout */}

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col glass border-r border-border/40 p-6 lg:flex relative z-20">
        {/* Brand + role badge */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative group">
            <DaddyAILogo size={40} className="rounded-lg shadow-[0_0_25px_color-mix(in srgb, var(--primary) 15%, transparent)] group-hover:shadow-[0_0_35px_color-mix(in srgb, var(--primary) 25%, transparent)] transition-shadow duration-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg font-bold leading-tight tracking-tight">
              Daddy <span className="text-primary">AI</span>
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider",
                userRole === "admin"     ? "bg-primary/20 text-primary" :
                userRole === "moderator" ? "bg-amber-500/20 text-amber-400" :
                userRole === "editor" ? "bg-blue-500/20 text-blue-400" :
                "bg-muted text-muted-foreground"
              )}>
                {userRole}
              </span>
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">Console v2</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          <CollapsibleNav
            sections={navSections}
            pathname={pathname}
            userRoleIndex={userRoleIndex}
            roles={roles}
          />
        </nav>

        <div className="mt-auto space-y-4 pt-6 border-t border-border/40">
          <div className="px-4 grid gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start text-[10px] uppercase tracking-widest font-black border-2 border-primary/20 hover:bg-primary/5 h-9 text-primary"
              onClick={() => document.documentElement.classList.toggle('high-contrast')}
            >
              <Activity className="size-3 mr-2 text-primary" /> High Contrast
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-[10px] uppercase tracking-widest font-black border-2 border-indigo-500/20 hover:bg-indigo-500/5 h-9 text-indigo-400"
              onClick={() => setShowMermaid(true)}
            >
              <GitBranch className="size-3 mr-2 text-indigo-400" /> Mermaid
            </Button>
            <div className="flex gap-2">
              <Link to="/privacy" className="text-[9px] text-muted-foreground hover:text-primary transition-colors">Privacy</Link>
              <Link to="/terms" className="text-[9px] text-muted-foreground hover:text-primary transition-colors">Terms</Link>
              <Link to="/privacy-request" className="text-[9px] text-muted-foreground hover:text-primary transition-colors">GDPR</Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (confirm("লগআউট করতে চান?")) {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }
              }}
              className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-destructive hover:bg-destructive/5 transition-colors border-2 border-transparent hover:border-destructive/20 h-11"
            >
              <LogOut className="size-4.5" /> লগআউট
            </button>
            <ThemeToggle className="shrink-0" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-y-auto">
        {/* Mobile Navbar Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border/20 bg-background/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg flex items-center justify-center overflow-hidden">
              <DaddyAILogo size={32} />
            </div>
            <span className="text-sm font-black tracking-tighter uppercase">
              Daddy <span className="text-primary">AI</span>
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-full hover:bg-primary/5"
          >
            {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </Button>
        </div>

        {/* Mobile Navigation Drawer — slide from left */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-30" role="dialog">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer panel */}
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-background border-r border-border/40 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
              <div className="flex items-center justify-between px-4 py-4 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <DaddyAILogo size={28} className="rounded-lg" />
                  <span className="font-display text-sm font-bold">Daddy <span className="text-primary">AI</span></span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar-hide px-3 py-3">
                <CollapsibleNav
                  sections={navSections}
                  pathname={pathname}
                  userRoleIndex={userRoleIndex}
                  roles={roles}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                />
              </div>
              <div className="px-3 py-4 border-t border-border/30 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="justify-center text-[10px] uppercase font-black border-2 border-primary/20 text-primary h-9"
                    onClick={() => { document.documentElement.classList.toggle('high-contrast'); setIsMobileMenuOpen(false); }}
                  >
                    <Activity className="size-3 mr-1" /> Contrast
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center text-[10px] uppercase font-black border-2 border-indigo-500/20 text-indigo-400 h-9"
                    onClick={() => { setShowMermaid(true); setIsMobileMenuOpen(false); }}
                  >
                    <GitBranch className="size-3 mr-1" /> Mermaid
                  </Button>
                </div>
                <button
                  onClick={async () => {
                    if (confirm("লগআউট করতে চান?")) {
                      await supabase.auth.signOut();
                      navigate({ to: "/auth" });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg text-[10px] uppercase font-black text-destructive bg-destructive/5 h-9 border border-destructive/20"
                >
                  <LogOut className="size-3" /> Logout
                </button>
                <div className="flex justify-center gap-4">
                  <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Privacy</Link>
                  <Link to="/terms" className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Terms</Link>
                  <Link to="/privacy-request" className="text-[10px] font-bold text-muted-foreground hover:text-foreground">GDPR</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Layout Header fallback for mobile scroll if menu closed */}
        {!isMobileMenuOpen && (
           <div className="lg:hidden h-1 overflow-hidden pointer-events-none" />
        )}
        <main className="min-w-0 flex-1 p-5 md:p-8 page-transition" key={pathname}>
          <Outlet />
        </main>
      </div>

      {/* Mermaid project flow modal */}
      <MermaidModal open={showMermaid} onClose={() => setShowMermaid(false)} />

    </div>
    </PinGuard>
  );
}


// ── CollapsibleNav ─────────────────────────────────────────────────────────────
// Collapsible sidebar nav sections with localStorage persistence.
// Active section auto-opens; all others collapse by default on first load.
function CollapsibleNav({
  sections,
  pathname,
  userRoleIndex,
  roles,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  userRoleIndex: number;
  roles: string[];
  onNavigate?: () => void;
}) {
  // Determine which section contains the active route
  const activeSection = sections.find((s) =>
    s.items.some((item) => (item.exact ? pathname === item.to : pathname.startsWith(item.to)))
  )?.title;

  // Init from localStorage, defaulting to only the active section open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof localStorage === "undefined") {
      return activeSection ? { [activeSection]: true } : {};
    }
    try {
      const saved = localStorage.getItem("daddyai-nav-open");
      return saved ? JSON.parse(saved) : (activeSection ? { [activeSection]: true } : {});
    } catch {
      return activeSection ? { [activeSection]: true } : {};
    }
  });

  function toggleSection(title: string) {
    setOpenSections((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem("daddyai-nav-open", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      {sections.map((section) => {
        // All items — visible (role OK) + locked (role insufficient)
        const allItems = section.items;
        const hasVisible = allItems.some((item) => {
          const req = roles.indexOf(item.minRole || "viewer");
          return userRoleIndex >= req;
        });
        if (!hasVisible) return null;

        const isOpen = openSections[section.title] ?? false;
        const hasActive = allItems.some((item) =>
          item.exact ? pathname === item.to : pathname.startsWith(item.to)
        );

        return (
          <div key={section.title} className="mb-0.5">
            {/* Section header — clickable */}
            <button
              onClick={() => toggleSection(section.title)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.14em] transition-colors duration-150",
                hasActive
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
              )}
            >
              <span>{section.title}</span>
              <ChevronDown
                className={cn(
                  "size-3 transition-transform duration-200",
                  isOpen ? "rotate-180" : ""
                )}
              />
            </button>

            {/* Items — shown when open */}
            {isOpen && (
              <div className="flex flex-col gap-0.5 mt-0.5 ml-1">
                {allItems.map((item) => {
                  const requiredRoleIndex = roles.indexOf(item.minRole || "viewer");
                  const locked = userRoleIndex < requiredRoleIndex;
                  const active = !locked && (item.exact ? pathname === item.to : pathname.startsWith(item.to));

                  if (locked) {
                    return (
                      <div
                        key={item.to}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] font-medium opacity-35 cursor-not-allowed select-none"
                        title={`Requires ${item.minRole} role`}
                      >
                        <Lock className="size-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">{item.label}</span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                        active
                          ? "bg-primary/15 text-primary border border-primary/25 shadow-sm"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                      )}
                    >
                      <item.icon className={cn("size-3.5 shrink-0", active ? "text-primary" : "")} />
                      <span className="truncate">{item.label}</span>
                      {active && <div className="ml-auto size-1.5 rounded-full bg-primary shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
