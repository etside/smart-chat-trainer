import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Daddy AI" },
      { name: "description", content: "Daddy AI terms of service and usage agreement." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-3xl mx-auto glass p-8 md:p-12 rounded-[2rem]">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-4xl font-bold mb-2 italic">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: August 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Daddy AI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including administrators, editors, viewers, and API consumers.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. Account Registration</h2>
            <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials. You must notify us immediately of any unauthorized access to your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. Ownership of Data</h2>
            <p>You retain all rights, title, and interest in your training data, conversation histories, and business content. You grant Daddy AI a limited license to process this data solely to provide the Service. We claim no ownership over your intellectual property.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Use the Service for any unlawful purpose or in violation of applicable regulations.</li>
              <li>Attempt to reverse-engineer, decompile, or extract the underlying AI models.</li>
              <li>Circumvent rate limits, token caps, or other usage controls.</li>
              <li>Share API keys or account credentials with unauthorized parties.</li>
              <li>Use the Service to process data that violates third-party rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Service Availability</h2>
            <p>We strive for high availability but do not guarantee uninterrupted service. We may perform maintenance, updates, or emergency repairs that temporarily affect access. We will provide reasonable advance notice for planned downtime.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. Pricing and Payment</h2>
            <p>Free tier usage is subject to fair-use limits. Paid plans are billed monthly in advance. All fees are non-refundable except where required by applicable law. We reserve the right to modify pricing with 30 days' notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. API Terms</h2>
            <p>API access is governed by API keys issued through your dashboard. Each key is subject to configurable rate limits and token caps. You are responsible for all activity that occurs under your API keys. We may revoke keys that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">8. White-Label and Reseller Terms</h2>
            <p>White-label partners may resell the Service under their own brand, subject to the terms of their partnership agreement. White-label partners are responsible for their own end users' compliance with these terms and applicable laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">9. Intellectual Property</h2>
            <p>The Service, including its software, AI models, design, and documentation, is owned by Daddy AI and protected by intellectual property laws. These terms do not grant you any rights to our trademarks, logos, or brand elements.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">10. Limitation of Liability</h2>
            <p>Daddy AI is a tool for business automation. We are not responsible for specific business outcomes, customer interactions, or decisions made by AI agents trained using the Service. Our total liability shall not exceed the fees paid by you in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">11. Termination</h2>
            <p>You may terminate your account at any time. We may suspend or terminate your access for violation of these terms. Upon termination, your data will be retained for 30 days and then permanently deleted unless otherwise required by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">12. Changes to Terms</h2>
            <p>We may update these terms from time to time. Material changes will be communicated at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">13. Governing Law</h2>
            <p>These terms are governed by the laws of the jurisdiction in which Daddy AI operates. Disputes shall be resolved through binding arbitration before litigation, except where prohibited by applicable law.</p>
          </section>
        </div>

        <div className="mt-10 pt-8 border-t border-border/40 text-center">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/auth">Create Account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
