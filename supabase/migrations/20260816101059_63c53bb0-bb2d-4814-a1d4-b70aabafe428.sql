CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid DEFAULT gen_random_uuid(),
    action text NOT NULL, -- 'transcription', 'analysis', 'reply'
    duration_ms integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.performance_metrics TO authenticated;
GRANT ALL ON public.performance_metrics TO service_role;

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all metrics" ON public.performance_metrics
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Internal service can insert metrics" ON public.performance_metrics
    FOR INSERT TO authenticated WITH CHECK (true);

-- Add streaming settings to agent_settings
ALTER TABLE public.agent_settings 
ADD COLUMN IF NOT EXISTS max_simultaneous_replies integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS enable_streaming boolean DEFAULT true;