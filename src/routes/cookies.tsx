import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Daddy AI" },
      { name: "description", content: "Daddy AI cookie policy and consent management." },
    ],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-3xl mx-auto glass p-8 md:p-12 rounded-[2rem]">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-4xl font-bold mb-2 italic">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: August 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit our website. They help us provide a better experience by remembering your preferences and session state.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. How We Use Cookies</h2>
            <p>We use cookies for the following purposes:</p>
            <div className="mt-4 space-y-4">
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground mb-2">Essential Cookies (Required)</h3>
                <p className="text-sm">These cookies are necessary for the website to function. They enable core features like authentication, session management, and security. Without these cookies, the service cannot work properly.</p>
                <ul className="list-disc pl-6 mt-2 text-sm space-y-1">
                  <li><strong className="text-foreground">Session token:</strong> Maintains your login session (expires after 24 hours of inactivity)</li>
                  <li><strong className="text-foreground">CSRF token:</strong> Protects against cross-site request forgery attacks</li>
                  <li><strong className="text-foreground">Consent record:</strong> Stores your cookie consent preferences</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground mb-2">Analytics Cookies (Optional)</h3>
                <p className="text-sm">Help us understand how visitors interact with our website by collecting anonymous usage data. This helps us improve the service.</p>
                <ul className="list-disc pl-6 mt-2 text-sm space-y-1">
                  <li><strong className="text-foreground">Usage analytics:</strong> Page views, feature usage, error rates (anonymized)</li>
                  <li><strong className="text-foreground">Performance metrics:</strong> Page load times, API response times</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. Cookies We Do NOT Use</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Advertising cookies:</strong> We do not track users across websites for advertising purposes.</li>
              <li><strong className="text-foreground">Third-party tracking:</strong> We do not share cookie data with advertisers or data brokers.</li>
              <li><strong className="text-foreground">Social media trackers:</strong> We do not embed social media tracking pixels (except Meta Pixel when configured by you for your own store).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Managing Cookies</h2>
            <p>You can control cookies through:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li><strong className="text-foreground">Browser settings:</strong> Most browsers allow you to block or delete cookies. Note that blocking essential cookies may prevent the service from working.</li>
              <li><strong className="text-foreground">Cookie consent banner:</strong> When you first visit, you can choose to accept all cookies or only essential ones.</li>
              <li><strong className="text-foreground">Clearing data:</strong> You can clear your cookie consent by clearing your browser's local storage for this domain.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Data Retention</h2>
            <p>Session cookies expire after 24 hours of inactivity. Consent cookies are stored for 12 months. Analytics data is retained for 90 days in anonymized form.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. GDPR & ePrivacy Compliance</h2>
            <p>Under the EU ePrivacy Directive and GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Be informed about cookie usage before they are placed</li>
              <li>Give or withhold consent for non-essential cookies</li>
              <li>Withdraw consent at any time</li>
              <li>Access information about which cookies are used</li>
            </ul>
            <p className="mt-3">We comply with these regulations by providing a cookie consent banner and this detailed cookie policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. Contact</h2>
            <p>For questions about our cookie policy, contact us at <a href="mailto:privacy@daddyai.com" className="text-primary hover:underline">privacy@daddyai.com</a>.</p>
          </section>
        </div>

        <div className="mt-10 pt-8 border-t border-border/40 text-center">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/privacy">Privacy Policy</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
