import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Settings, Cpu, KeyRound, Fingerprint } from "lucide-react";

const TABS = [
  { to: "/admin/settings", label: "General", icon: Settings },
  { to: "/admin/settings/mimo", label: "MIMO", icon: Cpu },
  { to: "/admin/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/admin/credentials", label: "Credentials", icon: Fingerprint },
] as const;

/**
 * Shared sub-tab bar for the Settings hub. Lets the four settings-related
 * pages live as one navigable group without merging their (large) bodies.
 */
export function SettingsTabs() {
  const { location } = useRouterState();
  const pathname = location.pathname;

  return (
    <div className="flex flex-wrap items-center gap-1 mb-6 p-1 rounded-2xl bg-card/40 border border-white/5 w-fit">
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
