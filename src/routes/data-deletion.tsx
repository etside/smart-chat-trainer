import { createFileRoute, Link } from '@tanstack/react-router';
import { Shield, CheckCircle, Info } from 'lucide-react';

export const Route = createFileRoute('/data-deletion')({
  component: DataDeletionStatus,
});

function DataDeletionStatus() {
  const search = Route.useSearch() as { id?: string };
  const confirmationCode = search.id;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25"></div>
            <Shield className="relative size-16 text-primary" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Data Deletion Status</h1>
          <p className="text-muted-foreground italic">
            Your privacy is our priority.
          </p>
        </div>

        <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl space-y-6">
          {confirmationCode ? (
            <>
              <div className="flex items-center justify-center gap-2 text-success">
                <CheckCircle className="size-5" />
                <span className="font-bold">Request Received</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Confirmation Code:</p>
                <code className="block p-3 bg-muted/50 rounded-lg font-mono text-primary select-all">
                  {confirmationCode}
                </code>
              </div>
              <p className="text-sm leading-relaxed">
                Your request to delete data associated with Daddy AI has been received and is being processed. 
                All associated user data will be purged from our records within 30 days.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-accent">
                <Info className="size-5" />
                <span className="font-bold">Invalid Request</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Please provide a valid confirmation code to check the status of your data deletion request.
              </p>
            </>
          )}
        </div>

        <div className="pt-4">
          <Link to="/" className="text-sm text-primary hover:underline font-medium">
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
