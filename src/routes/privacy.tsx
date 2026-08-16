import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-24">
      <div className="max-w-3xl mx-auto glass p-8 md:p-12 rounded-[2rem]">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">← Back to Home</Link>
        <h1 className="text-4xl font-bold mb-8 italic">Privacy Policy</h1>
        
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Information We Collect</h2>
            <p>We collect training data, conversation histories, and inventory synchronization parameters provided by you to improve your AI agents.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. How We Use Data</h2>
            <p>Your data is used strictly for training the specific AI agents connected to your account. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. GDPR Compliance</h2>
            <p>Under GDPR, you have the right to access, rectify, or erase your personal data. You can request a full data export or deletion through the admin console.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
