import { createFileRoute, Link } from '@tanstack/react-router';
import { Shield, CheckCircle, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getDataPolicy } from '@/lib/admin-extra.functions';

export const Route = createFileRoute('/data-deletion')({
  component: DataDeletionStatus,
});

function DataDeletionStatus() {
  const search = Route.useSearch() as { id?: string };
  const confirmationCode = search.id;
  const fetchPolicy = useServerFn(getDataPolicy);

  const { data: policyContent } = useQuery({
    queryKey: ['data-policy'],
    queryFn: () => fetchPolicy()
  });

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-6 pt-20">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25"></div>
            <Shield className="relative size-16 text-primary" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Data Policy & Privacy</h1>
          <p className="text-muted-foreground italic">
            Your privacy is our priority at Daddy AI.
          </p>
        </div>

        {confirmationCode && (
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl space-y-6 text-center">
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
          </div>
        )}

        <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl text-left prose prose-invert max-w-none">
          {policyContent ? (
            <div className="whitespace-pre-wrap">{policyContent}</div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Loading policy content...</p>
          )}
        </div>

        <div className="pt-4 pb-20">
          <Link to="/" className="text-sm text-primary hover:underline font-medium">
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
