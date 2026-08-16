-- 1. Create audit_logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- 2. Add last_sync_status and sync tracking to agent_settings
ALTER TABLE public.agent_settings 
ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_sync_details JSONB DEFAULT '{}'::jsonb;

-- 3. Create function to log audits securely
CREATE OR REPLACE FUNCTION public.log_audit(_actor_id UUID, _action TEXT, _entity_type TEXT, _entity_id UUID, _metadata JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor_id, _action, _entity_type, _entity_id, _metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit TO authenticated;