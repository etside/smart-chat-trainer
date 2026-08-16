CREATE TABLE public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    credits_used NUMERIC NOT NULL DEFAULT 0,
    cost_usd NUMERIC NOT NULL DEFAULT 0,
    cost_bdt NUMERIC NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_settings ADD COLUMN usage_config JSONB DEFAULT '{
  "ai_message": {"credits": 1, "usd": 0.002, "bdt": 0.24},
  "lead_scoring": {"credits": 5, "usd": 0.01, "bdt": 1.20},
  "product_sync": {"credits": 10, "usd": 0.02, "bdt": 2.40}
}'::jsonb;

GRANT SELECT ON public.usage_logs TO authenticated;
GRANT INSERT ON public.usage_logs TO authenticated;
GRANT ALL ON public.usage_logs TO service_role;

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage logs" 
ON public.usage_logs FOR SELECT 
TO authenticated 
USING (auth.uid() = actor_id);

CREATE POLICY "Admins can view all usage logs" 
ON public.usage_logs FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
