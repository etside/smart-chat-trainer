import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Daddy AI" },
      { name: "description", content: "Daddy AI privacy policy and data handling practices." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-3xl mx-auto glass p-8 md:p-12 rounded-[2rem]">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-4xl font-bold mb-2 italic">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: August 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-foreground">Account information:</strong> Email address, name, and authentication credentials when you create an account.</li>
              <li><strong className="text-foreground">Training data:</strong> Voice recordings, text inputs, product information, and conversation histories you provide to train your AI agents.</li>
              <li><strong className="text-foreground">Usage data:</strong> API request logs, feature usage patterns, and performance metrics to improve service quality.</li>
              <li><strong className="text-foreground">Integration data:</strong> Inventory data, catalog information, and webhook payloads from connected systems.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. How We Use Your Data</h2>
            <p>Your data is used exclusively to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Train and operate your AI sales agents.</li>
              <li>Process voice transcriptions and extract structured training information.</li>
              <li>Sync inventory and catalog data across your connected platforms.</li>
              <li>Provide analytics and performance insights for your account.</li>
              <li>Ensure platform security, detect abuse, and enforce rate limits.</li>
            </ul>
            <p className="mt-3">We <strong className="text-foreground">never</strong> sell your data to third parties or use your training data to train models for other customers.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. Data Security</h2>
            <p>We implement industry-standard security measures:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>256-bit AES encryption for data at rest.</li>
              <li>TLS 1.3 encryption for data in transit.</li>
              <li>Regular security audits and penetration testing.</li>
              <li>Role-based access controls and API key authentication.</li>
              <li>Automated threat detection and monitoring.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Data Retention</h2>
            <p>Your data is retained as long as your account is active. Upon account deletion, all personal data and training data are permanently removed within 30 days. Anonymized usage analytics may be retained for service improvement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Third-Party Services</h2>
            <p>We use the following third-party services to operate our platform:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-foreground">Supabase:</strong> Database and authentication infrastructure.</li>
              <li><strong className="text-foreground">Vercel:</strong> Application hosting and deployment.</li>
              <li><strong className="text-foreground">AI Model Providers:</strong> For voice transcription and language processing.</li>
            </ul>
            <p className="mt-3">These providers are contractually obligated to protect your data and are not permitted to use it for their own purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. GDPR Rights</h2>
            <p>Under the General Data Protection Regulation (GDPR), you have the following rights:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-foreground">Right of access:</strong> Request a copy of all data we hold about you.</li>
              <li><strong className="text-foreground">Right to rectification:</strong> Request correction of inaccurate data.</li>
              <li><strong className="text-foreground">Right to erasure:</strong> Request deletion of your personal data.</li>
              <li><strong className="text-foreground">Right to restrict processing:</strong> Request limitation of data processing.</li>
              <li><strong className="text-foreground">Right to data portability:</strong> Receive your data in a machine-readable format.</li>
              <li><strong className="text-foreground">Right to object:</strong> Object to processing based on legitimate interests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. CCPA Rights</h2>
            <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete personal information, and the right to opt out of the sale of personal information. We do not sell personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">8. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">9. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Material changes will be communicated via email or dashboard notification at least 30 days before they take effect.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">10. Contact Us</h2>
            <p>For privacy-related inquiries or to exercise your rights, submit a request through our <Link to="/privacy-request" className="text-primary hover:underline font-bold">Privacy Request Portal</Link> or contact our Data Protection Officer at privacy@daddyai.com.</p>
          </section>
        </div>

        <div className="mt-10 pt-8 border-t border-border/40 text-center">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/privacy-request">Submit a Privacy Request</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
