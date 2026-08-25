import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shield, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const CONSENT_KEY = "daddyai_cookie_consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      essential: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    }));
    setShow(false);
  };

  const reject = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      essential: true,
      analytics: false,
      timestamp: new Date().toISOString(),
    }));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="font-bold text-sm">Cookie & Privacy Notice</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use essential cookies for authentication and session management.
              Analytics cookies help us improve the service. We never use advertising
              or tracking cookies. By continuing, you agree to our{" "}
              <Link to="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</Link>{" "}
              and{" "}
              <Link to="/cookies" className="text-primary hover:underline font-medium">Cookie Policy</Link>.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={accept} className="rounded-full text-xs">
                Accept All
              </Button>
              <Button size="sm" variant="outline" onClick={reject} className="rounded-full text-xs">
                Essential Only
              </Button>
              <Link to="/cookies" className="text-xs text-muted-foreground hover:text-foreground self-center ml-2">
                Manage Preferences
              </Link>
            </div>
          </div>
          <button onClick={reject} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
