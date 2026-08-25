import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin, getMyRole } from "@/lib/console.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import logoAsset from "@/assets/daddy-ai-logo.png.asset.json";
import {
  Activity,
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
  MessageSquare,
  BookOpen,
  Menu,
  X,
  Wand2,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";

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
  minRole?: "admin" | "editor" | "viewer";
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, minRole: "viewer" },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3, minRole: "viewer" },
      { to: "/admin/usage", label: "Usage", icon: BarChart3, minRole: "admin" },
      { to: "/admin/onboarding", label: "Setup Wizard", icon: PlusCircle, minRole: "admin" },
    ],
  },
  {
    title: "Training",
    items: [
      { to: "/admin/training", label: "Training Data", icon: Database, minRole: "viewer" },
      { to: "/admin/add", label: "Add Data", icon: PlusCircle, minRole: "editor" },
      { to: "/admin/skill-builder", label: "Skill Builder", icon: Wand2, minRole: "editor" },
      { to: "/admin/canned-responses", label: "Templates", icon: MessageSquare, minRole: "editor" },
      { to: "/admin/auto-replies", label: "Auto-Replies", icon: MessageSquare, minRole: "editor" },
    ],
  },
  {
    title: "Conversations",
    items: [
      { to: "/admin/inbox", label: "Inbox", icon: MessagesSquare, minRole: "viewer" },
      { to: "/admin/playground", label: "Playground", icon: MessagesSquare, minRole: "viewer" },
      { to: "/admin/flow-builder", label: "Flow Builder", icon: Wand2, minRole: "editor" },
    ],
  },
  {
    title: "Monitor",
    items: [
      { to: "/admin/sync", label: "Sync Status", icon: Activity, minRole: "viewer" },
      { to: "/admin/progress", label: "Training Live", icon: Activity, minRole: "viewer" },
      { to: "/admin/webhook-test", label: "Webhook Test", icon: Terminal, minRole: "editor" },
    ],
  },
  {
    title: "Logs",
    items: [
      { to: "/admin/audit-logs", label: "Audit Logs", icon: History, minRole: "admin" },
      { to: "/admin/logs", label: "Event Logs", icon: History, minRole: "admin" },
      { to: "/admin/performance", label: "Performance", icon: Activity, minRole: "admin" },
      { to: "/admin/webhook-dlq", label: "Webhook DLQ", icon: Terminal, minRole: "editor" },
    ],
  },
  {
    title: "Config",
    items: [
      { to: "/admin/settings", label: "Settings", icon: Settings, minRole: "admin" },
      { to: "/admin/settings/mimo", label: "AI / MiMo", icon: Sparkles, minRole: "admin" },
      { to: "/admin/api-keys", label: "API Keys", icon: KeyRound, minRole: "admin" },
      { to: "/admin/connections", label: "Connections", icon: KeyRound, minRole: "admin" },
      { to: "/admin/tutorials", label: "Tutorials", icon: BookOpen, minRole: "viewer" },
    ],
  },
  {
    title: "External",
    items: [
      { to: "/connect", label: "AI Connect", icon: Terminal, minRole: "viewer" },
      { to: "/api", label: "API & White Label", icon: Code2, minRole: "viewer" },
      { to: "/faq", label: "FAQ", icon: MessageSquare, minRole: "viewer" },
      { to: "/knowledge-base", label: "Knowledge Base", icon: MessageSquare, minRole: "viewer" },
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

function AdminLayout() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchMyRole = useServerFn(getMyRole);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const roles = ["user", "viewer", "editor", "admin"];
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
    <div className="flex min-h-screen bg-background selection:bg-primary/20 noise-overlay overflow-hidden mesh-bg transition-colors duration-500">
      {/* 2-Column Responsive Layout */}


      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col glass border-r border-border/40 p-6 lg:flex relative z-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <img src={logoAsset.url} alt="Daddy AI" className="relative size-10 rounded-lg shadow-xl" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-tight tracking-tight">Daddy AI</p>
            <p className="text-[10px] uppercase tracking-widest text-primary font-black opacity-70">Console v2.0 • {userRole}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => {
              const requiredRoleIndex = roles.indexOf(item.minRole || "viewer");
              return userRoleIndex >= requiredRoleIndex;
            });
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold px-4 mb-1">{section.title}</p>
                <div className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => {
                    const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-150",
                          active
                            ? "bg-black text-white shadow-md shadow-black/20"
                            : "text-muted-foreground hover:bg-black/5 hover:text-black",
                        )}
                      >
                        <item.icon className={cn("size-3.5", active ? "text-white" : "group-hover:scale-110 transition-transform")} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 pt-6 border-t border-border/40">
          <div className="px-4 grid gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start text-[10px] uppercase tracking-widest font-black border-2 border-primary/20 hover:bg-primary/5 h-9"
              onClick={() => document.documentElement.classList.toggle('high-contrast')}
            >
              <Activity className="size-3 mr-2 text-primary" /> High Contrast
            </Button>
            <div className="flex gap-2">
              <Link to="/privacy" className="text-[9px] text-muted-foreground hover:text-primary transition-colors">Privacy</Link>
              <Link to="/terms" className="text-[9px] text-muted-foreground hover:text-primary transition-colors">Terms</Link>
              <Link to="/privacy-request" className="text-[9px] text-muted-foreground hover:text-primary transition-colors">GDPR</Link>
            </div>
          </div>
          <button
            onClick={async () => {
              if (confirm("লগআউট করতে চান?")) {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-destructive hover:bg-destructive/5 transition-colors border-2 border-transparent hover:border-destructive/20 h-11"
          >
            <LogOut className="size-4.5" /> লগআউট
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-y-auto">
        {/* Mobile Navbar Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border/20 bg-background/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-2">
             <div className="size-8 rounded-lg bg-black flex items-center justify-center">
               <img src={logoAsset.url} alt="Logo" className="size-5 invert" />
             </div>
             <span className="text-sm font-black tracking-tighter uppercase">Daddy AI</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-full hover:bg-black/5"
          >
            {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </Button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-30 bg-background/95 backdrop-blur-lg pt-20 pb-6 px-4 flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar-hide">
              {navSections.map((section) => {
                const visibleItems = section.items.filter((item) => {
                  const requiredRoleIndex = roles.indexOf(item.minRole || "viewer");
                  return userRoleIndex >= requiredRoleIndex;
                });
                if (visibleItems.length === 0) return null;
                return (
                  <div key={section.title}>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold px-5 mb-1">{section.title}</p>
                    <div className="flex flex-col gap-1">
                      {visibleItems.map((item) => {
                        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                              active
                                ? "bg-black text-white shadow-lg"
                                : "text-muted-foreground hover:bg-black/5 active:bg-black/10"
                            )}
                          >
                            <item.icon className={cn("size-5", active && "animate-pulse")} />
                            {item.label}
                            {active && <div className="ml-auto size-1.5 rounded-full bg-primary" />}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 space-y-4 pt-6 border-t border-border/40">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="justify-center text-[10px] uppercase font-black border-2 h-10"
                  onClick={() => document.documentElement.classList.toggle('high-contrast')}
                >
                  <Activity className="size-3 mr-2" /> Contrast
                </Button>
                <button
                  onClick={async () => {
                    if (confirm("লগআউট করতে চান?")) {
                      await supabase.auth.signOut();
                      navigate({ to: "/auth" });
                    }
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl text-[10px] uppercase font-black text-destructive bg-destructive/5 h-10 border-2 border-destructive/20"
                >
                  <LogOut className="size-3" /> Logout
                </button>
              </div>
              <div className="flex justify-center gap-6">
                <Link to="/privacy" className="text-[11px] font-bold text-muted-foreground">Privacy</Link>
                <Link to="/terms" className="text-[11px] font-bold text-muted-foreground">Terms</Link>
                <Link to="/privacy-request" className="text-[11px] font-bold text-muted-foreground">GDPR</Link>
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

    </div>
  );
}
