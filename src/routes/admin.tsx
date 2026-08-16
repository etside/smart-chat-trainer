import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/console.functions";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import logoAsset from "@/assets/daddy-ai-logo.png.asset.json";
import {
  Activity,
  Database,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  PlusCircle,
  Settings,
  Terminal,
} from "lucide-react";
import { useEffect } from "react";

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

const nav: Array<{
  to: "/admin" | "/admin/training" | "/admin/add" | "/admin/playground" | "/admin/connections" | "/admin/settings" | "/admin/progress" | "/admin/webhook-test" | "/admin/sync" | "/connect";
  label: string;
  icon: typeof Database;
  exact?: boolean;
}> = [
  { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
  { to: "/admin/training", label: "ট্রেনিং ডেটা", icon: Database },
  { to: "/admin/add", label: "নতুন ডেটা", icon: PlusCircle },
  { to: "/admin/playground", label: "প্লেগ্রাউন্ড", icon: MessagesSquare },
  { to: "/admin/sync", label: "সিঙ্ক স্ট্যাটাস", icon: Activity },
  { to: "/admin/progress", label: "ট্রেনিং প্রগ্রেস", icon: Activity },
  { to: "/admin/connections", label: "কানেকশন", icon: KeyRound },
  { to: "/admin/webhook-test", label: "টেস্ট প্যানেল", icon: Terminal },
  { to: "/admin/settings", label: "সেটিংস", icon: Settings },
  { to: "/connect", label: "AI কানেক্ট", icon: Terminal },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkAdmin = useServerFn(amIAdmin);

  const adminQuery = useQuery({
    queryKey: ["is-admin", session?.user.id],
    queryFn: () => checkAdmin(),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || (session && adminQuery.isLoading)) {
    return <div className="p-10 text-sm text-muted-foreground">লোড হচ্ছে...</div>;
  }

  if (session && adminQuery.data && !adminQuery.data.admin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-sm text-muted-foreground">এই অ্যাকাউন্টের অ্যাডমিন অ্যাক্সেস নেই।</p>
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
    <div className="flex min-h-screen bg-background selection:bg-primary/20 noise-overlay">
      {/* Enhanced Sidebar */}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col glass border-r-0 p-6 md:flex relative z-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <img src={logoAsset.url} alt="Daddy AI" className="relative size-10 rounded-lg shadow-xl" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-tight tracking-tight">Daddy AI</p>
            <p className="text-[10px] uppercase tracking-widest text-primary font-black opacity-70">Console v2.0</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 relative group",
                  active
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-primary",
                )}
              >
                <item.icon className={cn("size-4.5", active ? "text-primary-foreground" : "group-hover:scale-110 transition-transform")} />
                {item.label}
                {active && <div className="absolute right-2 size-1.5 rounded-full bg-primary-foreground/50" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 pt-6 border-t border-border/40">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="size-4.5" /> লগআউট
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs hover:bg-sidebar-accent/60"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-5 md:p-8 page-transition" key={pathname}>
          <Outlet />
        </main>
      </div>

    </div>
  );
}
