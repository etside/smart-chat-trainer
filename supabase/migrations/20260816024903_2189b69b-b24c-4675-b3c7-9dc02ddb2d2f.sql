-- Add idempotency and metadata to sync_runs
ALTER TABLE public.sync_runs ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE public.sync_runs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add scheduling info to agent_settings
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS sync_schedule TEXT DEFAULT 'daily'; -- daily, hourly, weekly, manual
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Ensure training_jobs can be linked to sync_runs
ALTER TABLE public.training_jobs ADD COLUMN IF NOT EXISTS sync_run_id UUID REFERENCES public.sync_runs(id);

-- Grants (redundant but safe)
GRANT SELECT, INSERT, UPDATE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
GRANT SELECT, UPDATE ON public.agent_settings TO authenticated;
GRANT ALL ON public.agent_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.training_jobs TO authenticated;
GRANT ALL ON public.training_jobs TO service_role;
