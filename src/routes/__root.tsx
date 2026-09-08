import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, useState, createContext, useContext } from "react";
import { getMetaCredentials, getMetaCredentialsPublic } from "../lib/settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { getExtraSettings } from "../lib/extra-settings.functions";
import { useQuery } from "@tanstack/react-query";

import { Toaster } from "../components/ui/sonner";
import { SupportModal } from "../components/SupportModal";
import { CookieConsent } from "../components/CookieConsent";
import appCss from "../styles.css?url";

// ── Theme context ─────────────────────────────────────────────────────────
interface ThemeCtx { theme: "light" | "dark"; toggle: () => void }
export const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });
export function useTheme() { return useContext(ThemeContext); }
function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[DaddyAI Error]", error, context);
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Root Error:", error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center p-8 glass rounded-3xl border border-white/10 shadow-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-4">
          Console Load Error
        </h1>
        <div className="text-left bg-black/20 p-4 rounded-xl mb-6 overflow-auto max-h-40">
          <code className="text-xs text-red-400">{error.message}</code>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-all hover:scale-105"
          >
            Retry Connection
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background/50 px-6 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent"
          >
            Back Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "DaddyAI — AI Sales Agent for Bangladesh" },
      { name: "description", content: "DaddyAI replies to customers 24/7 in Bangla, Banglish & English on Messenger, Instagram and WhatsApp. Auto-replies, vision AI, live inbox." },
      { name: "author", content: "DaddyAI" },
      { name: "application-name", content: "DaddyAI" },
      { name: "theme-color", content: "#68f044" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "DaddyAI" },
      { name: "msapplication-TileColor", content: "#68f044" },
      { name: "msapplication-TileImage", content: "/icon-144x144.png" },
      // Open Graph
      { property: "og:title", content: "DaddyAI — AI Sales Agent for Bangladesh" },
      { property: "og:description", content: "Auto-replies in Bangla, Banglish & English on Messenger, Instagram and WhatsApp. Vision AI, live inbox, 24/7." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:site_name", content: "DaddyAI" },
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DaddyAI — AI Sales Agent" },
      { name: "twitter:description", content: "AI sales agent for Bangladeshi businesses on Messenger, Instagram & WhatsApp." },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" },
      // Icons
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", href: "/icon-152x152.png", sizes: "152x152" },
      // PWA manifest
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Load saved theme on mount
  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("daddyai-theme") : null;
    const preferred = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(preferred as "light" | "dark");
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("daddyai-theme", theme);
    }
  }, [theme]);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <html lang="en" className={theme}>
        <head>
          <HeadContent />
          {/* Prevent flash of wrong theme */}
          <script dangerouslySetInnerHTML={{ __html: `
            (function(){
              var t = localStorage.getItem('daddyai-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              document.documentElement.className = t;
            })();
          ` }} />
        </head>
        <body>
          <QueryClientProvider client={queryClient}>
            <InnerRoot />
            <Toaster position="top-center" richColors />
            <SupportModal />
            <CookieConsent />
          </QueryClientProvider>
          <Scripts />
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .then(function(reg) { console.log('[SW] registered', reg.scope); })
                  .catch(function(err) { console.warn('[SW] registration failed', err); });
              });
            }
          ` }} />
        </body>
      </html>
    </ThemeContext.Provider>
  );
}

function InnerRoot() {
  const fetchMetaCreds = useServerFn(getMetaCredentialsPublic);
  const fetchExtra = useServerFn(getExtraSettings);
  
  const { data: extra } = useQuery({ 
    queryKey: ["extra-settings-public"], 
    queryFn: () => fetchExtra(),
    retry: false,
    staleTime: 60000,
  });

  const [metaConfig, setMetaConfig] = useState<{ appId: string; apiVersion: string } | null>(null);

  useEffect(() => {
    if (extra?.reduceMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [extra]);

  useEffect(() => {
    fetchMetaCreds()
      .then((data) => {
        if (data && data.appId) {
          setMetaConfig({
            appId: data.appId,
            apiVersion: (data as any).apiVersion || "v19.0",
          });
        }
      })
      .catch((err) => {
        // This is fine on public routes
      });
  }, [fetchMetaCreds]);

  useEffect(() => {
    if (!metaConfig?.appId || typeof window === "undefined") return;

    // @ts-ignore
    window.fbAsyncInit = function () {
      // @ts-ignore
      FB.init({
        appId: metaConfig.appId,
        cookie: true,
        xfbml: true,
        version: metaConfig.apiVersion,
      });
      
      // @ts-ignore
      FB.getLoginStatus(function(response) {
        window.dispatchEvent(new CustomEvent('fb-login-status', { detail: response }));
      });

      // @ts-ignore
      FB.AppEvents.logPageView();
    };

    (function (d, s, id) {
      var js,
        fjs = d.getElementsByTagName(s)[0];
      if (!fjs || d.getElementById(id)) {
        return;
      }
      js = d.createElement(s) as HTMLScriptElement;
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode?.insertBefore(js, fjs);
    })(document, "script", "facebook-jssdk");
  }, [metaConfig]);

  return <Outlet />;
}