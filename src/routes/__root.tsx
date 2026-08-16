import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, useState } from "react";
import { getMetaCredentials } from "../lib/settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { getExtraSettings } from "../lib/extra-settings.functions";
import { useQuery } from "@tanstack/react-query";

import { Toaster } from "../components/ui/sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

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
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Daddy AI Console" },
      {
        name: "description",
        content: "Daddy AI-এর সেলস এজেন্ট ট্রেনিং কনসোল।",
      },
      { name: "author", content: "Daddy AI" },
      { property: "og:title", content: "Daddy AI Console" },
      {
        property: "og:description",
        content: "Daddy AI-এর সেলস এজেন্ট ট্রেনিং কনসোল।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <InnerRoot />
          <Toaster position="top-center" richColors />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function InnerRoot() {
  const fetchMetaCreds = useServerFn(getMetaCredentials);
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