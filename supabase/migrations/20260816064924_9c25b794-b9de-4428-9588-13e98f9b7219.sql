-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL, -- 'meta', 'sync', 'custom'
    event_type text, -- 'deauthorize', 'data_deletion', 'catalog_sync', etc.
    payload jsonb,
    headers jsonb,
    status_code integer,
    created_at timestamptz DEFAULT now()
);

-- Grant access to webhook_logs
GRANT SELECT, INSERT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can see logs
CREATE POLICY "Admins can see webhook logs" ON public.webhook_logs
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add data_policy_content to agent_settings
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS data_policy_content text DEFAULT '# Data Policy\n\nYour data policy content here...';
