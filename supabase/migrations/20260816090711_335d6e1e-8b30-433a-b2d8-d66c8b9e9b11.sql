-- 1. Update app_role enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'editor') THEN
        ALTER TYPE public.app_role ADD VALUE 'editor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'viewer') THEN
        ALTER TYPE public.app_role ADD VALUE 'viewer';
    END IF;
END $$;

-- 2. Update has_role function to support hierarchy
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    actual_role public.app_role;
BEGIN
    SELECT role INTO actual_role FROM public.user_roles WHERE user_id = _user_id;
    
    IF actual_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Hierarchy: admin > editor > viewer > user
    IF _role = 'admin' THEN
        RETURN actual_role = 'admin';
    ELSIF _role = 'editor' THEN
        RETURN actual_role IN ('admin', 'editor');
    ELSIF _role = 'viewer' THEN
        RETURN actual_role IN ('admin', 'editor', 'viewer');
    ELSE
        RETURN TRUE; -- Any role satisfies 'user' or lower
    END IF;
END;
$$;

-- 3. Update webhook_logs for retries and DLQ
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS error_details text;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'success' CHECK (processing_status IN ('pending', 'success', 'failed', 'dead_letter'));

CREATE INDEX IF NOT EXISTS webhook_logs_retry_idx ON public.webhook_logs(processing_status, next_retry_at) WHERE processing_status = 'pending';

-- 4. Grant access to new roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.training_pairs TO authenticated;
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT SELECT ON public.training_jobs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;
