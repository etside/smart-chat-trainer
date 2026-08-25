import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Shield, Lock, Eye, FileCheck, Globe, CreditCard, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance & Security — Daddy AI" },
      { name: "description", content: "Daddy AI compliance certifications, security practices, and regulatory adherence." },
    ],
  }),
  component: CompliancePage,
});

function CompliancePage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-3xl mx-auto glass p-8 md:p-12 rounded-[2rem]">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-4xl font-bold mb-2 italic">Compliance & Security</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: August 2026</p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">

          {/* Security Overview */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="size-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Security Overview</h2>
            </div>
            <p>Daddy AI implements industry-standard security measures to protect your data, training models, and business operations. Our security practices are designed to meet or exceed compliance requirements for GDPR, PCI DSS, and Meta Business Partner standards.</p>
          </section>

          {/* PCI DSS */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="size-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">PCI DSS Compliance</h2>
            </div>
            <p>Daddy AI does not directly process, store, or transmit cardholder data. Payment processing is handled by third-party PCI DSS Level 1 certified payment providers (SSLCOMez, bKash, Nagad). Our role is limited to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Redirecting users to payment provider checkout pages</li>
              <li>Receiving payment confirmation callbacks (status only, no card data)</li>
              <li>Storing order records with payment reference IDs (not card numbers)</li>
            </ul>
            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <h3 className="font-bold text-foreground text-sm mb-2">PCI DSS Requirements We Meet:</h3>
              <ul className="text-sm space-y-1">
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 1: Install and maintain network security controls</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 2: Apply secure configurations to all system components</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 3: Protect stored account data (no cardholder data stored)</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 4: Protect cardholder data with strong cryptography during transmission (TLS 1.2/1.3)</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 6: Develop and maintain secure systems and software</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 8: Identify users and authenticate access to system components</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 10: Log and monitor all access to network resources and cardholder data</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 11: Regularly test security systems and processes</li>
                <li className="flex items-start gap-2"><CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" /> Requirement 12: Maintain an information security policy</li>
              </ul>
            </div>
          </section>

          {/* GDPR */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Globe className="size-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">GDPR Compliance</h2>
            </div>
            <p>Daddy AI complies with the European Union's General Data Protection Regulation (GDPR) for all users, regardless of location.</p>
            <div className="mt-4 space-y-3">
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Legal Basis for Processing</h3>
                <p className="text-sm mt-1">We process data based on: (1) Contract performance — providing the service you signed up for; (2) Legitimate interest — improving service quality and security; (3) Consent — for optional analytics cookies and marketing.</p>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Data Protection Officer</h3>
                <p className="text-sm mt-1">Our Data Protection Officer can be reached at <a href="mailto:privacy@daddyai.com" className="text-primary hover:underline">privacy@daddyai.com</a>.</p>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Data Processing Agreement</h3>
                <p className="text-sm mt-1">We offer a Data Processing Agreement (DPA) to all customers. Contact us to request a signed DPA. Our DPA covers: data categories, processing purposes, sub-processors, security measures, and cross-border transfer safeguards.</p>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">International Data Transfers</h3>
                <p className="text-sm mt-1">Data is processed in the EU (Supabase EU region) and Bangladesh. For transfers outside the EEA, we rely on Standard Contractual Clauses (SCCs) and ensure equivalent protection through technical and organizational measures.</p>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Your GDPR Rights</h3>
                <ul className="text-sm mt-1 space-y-1">
                  <li>Right of access — request a copy of your data</li>
                  <li>Right to rectification — correct inaccurate data</li>
                  <li>Right to erasure — request deletion of your data</li>
                  <li>Right to restrict processing — limit how we use your data</li>
                  <li>Right to data portability — receive your data in machine-readable format</li>
                  <li>Right to object — object to processing based on legitimate interests</li>
                  <li>Right to withdraw consent — at any time, without affecting prior processing</li>
                </ul>
                <p className="text-sm mt-2">Exercise your rights via <Link to="/privacy-request" className="text-primary hover:underline font-medium">Privacy Request Portal</Link>.</p>
              </div>
            </div>
          </section>

          {/* Meta Business Compliance */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Eye className="size-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Meta Business Partner Compliance</h2>
            </div>
            <p>When using Daddy AI's Facebook Messenger, Instagram, or WhatsApp integrations, we comply with Meta's Platform Terms and Business Terms:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-foreground">Webhook signature verification:</strong> All incoming webhooks from Meta are verified using HMAC-SHA256 (X-Hub-Signature-256) to prevent spoofing.</li>
              <li><strong className="text-foreground">Data deletion callback:</strong> We implement Meta's required data deletion endpoint (<code className="text-xs bg-muted/50 px-1 rounded">/api/public/meta/deletion</code>) with proper signed_request verification.</li>
              <li><strong className="text-foreground">User data handling:</strong> We only store message content necessary for AI training. We do not sell or share user data with third parties.</li>
              <li><strong className="text-foreground">Permission requests:</strong> We only request permissions necessary for the service (pages_messaging, whatsapp_business_messaging, pages_manage_metadata).</li>
              <li><strong className="text-foreground">Data retention:</strong> Message data is retained for training purposes and can be deleted upon user request via the Privacy Request Portal.</li>
              <li><strong className="text-foreground">App Review:</strong> Our Meta app configuration supports the App Review process required for public use of webhooks.</li>
            </ul>
          </section>

          {/* Technical Security */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Lock className="size-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Technical Security Measures</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Encryption</h3>
                <ul className="text-sm mt-1 space-y-1">
                  <li>Data at rest: 256-bit AES encryption via Supabase/PostgreSQL</li>
                  <li>Data in transit: TLS 1.2/1.3 (enforced via nginx SSL configuration)</li>
                  <li>Passwords: bcrypt with 12 rounds of salt</li>
                  <li>API keys: SHA-256 hashed, never stored in plaintext</li>
                  <li>Webhook payloads: HMAC-SHA256 signed for integrity verification</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Access Controls</h3>
                <ul className="text-sm mt-1 space-y-1">
                  <li>Role-based access control (Admin, Editor, Viewer)</li>
                  <li>JWT-based session authentication with expiry</li>
                  <li>API key authentication with rate limiting</li>
                  <li>Webhook authentication via Bearer tokens</li>
                  <li>IP-based rate limiting on public endpoints</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Network Security</h3>
                <ul className="text-sm mt-1 space-y-1">
                  <li>HTTP to HTTPS redirect (301)</li>
                  <li>Content Security Policy (CSP) headers</li>
                  <li>X-Frame-Options: SAMEORIGIN</li>
                  <li>X-Content-Type-Options: nosniff</li>
                  <li>X-XSS-Protection: 1; mode=block</li>
                  <li>Referrer-Policy: strict-origin-when-cross-origin</li>
                  <li>Hidden file access denied via nginx</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Monitoring & Logging</h3>
                <ul className="text-sm mt-1 space-y-1">
                  <li>Comprehensive audit logging of all admin actions</li>
                  <li>Webhook delivery tracking with dead letter queue</li>
                  <li>Performance metrics and latency monitoring</li>
                  <li>Usage tracking and anomaly detection</li>
                  <li>Error tracking and alerting</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Database & Storage */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <FileCheck className="size-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Database & Storage Security</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Database</h3>
                <ul className="text-sm mt-1 space-y-1">
                  <li>PostgreSQL with pgvector extension for semantic search</li>
                  <li>Row-level security policies for multi-tenant isolation</li>
                  <li>Encrypted connections (SSL enforced)</li>
                  <li>Regular automated backups</li>
                  <li>Database credentials stored in environment variables, never in code</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-border/40">
                <h3 className="font-bold text-foreground text-sm">Secrets Management</h3>
                <ul className="text-sm mt-1 space-y-1">
                  <li>All API keys and secrets stored in environment variables</li>
                  <li>.env files excluded from version control (.gitignore)</li>
                  <li>GitHub Actions secrets for CI/CD credentials</li>
                  <li>Credential rotation supported with audit logging</li>
                  <li>No secrets in client-side code (VITE_ prefix only for public keys)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Incident Response */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="size-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Incident Response</h2>
            </div>
            <p>We maintain an incident response plan that includes:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>24-hour notification window for security incidents affecting user data</li>
              <li>Automated error tracking and alerting for system anomalies</li>
              <li>Webhook dead letter queue for failed delivery investigation</li>
              <li>Audit trail for forensic analysis of unauthorized access attempts</li>
              <li>Regular security reviews of third-party integrations</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">Contact & Reports</h2>
            <p>To report a security vulnerability or compliance concern:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Security issues: <a href="mailto:security@daddyai.com" className="text-primary hover:underline">security@daddyai.com</a></li>
              <li>Privacy concerns: <a href="mailto:privacy@daddyai.com" className="text-primary hover:underline">privacy@daddyai.com</a></li>
              <li>GDPR requests: <Link to="/privacy-request" className="text-primary hover:underline font-medium">Privacy Request Portal</Link></li>
            </ul>
          </section>
        </div>

        <div className="mt-10 pt-8 border-t border-border/40 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Related policies</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button asChild variant="outline" className="rounded-full text-sm">
              <Link to="/privacy">Privacy Policy</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full text-sm">
              <Link to="/terms">Terms of Service</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full text-sm">
              <Link to="/cookies">Cookie Policy</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
