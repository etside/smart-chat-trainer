
-- 1. Tenant platform credentials
CREATE TABLE IF NOT EXISTS public.tenant_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  client_token text NOT NULL,
  client_secret text NOT NULL,
  webhook_verify_token text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

GRANT SELECT ON public.tenant_credentials TO authenticated;
GRANT ALL ON public.tenant_credentials TO service_role;
ALTER TABLE public.tenant_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own credentials readable" ON public.tenant_credentials;
CREATE POLICY "own credentials readable" ON public.tenant_credentials
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. Auto reply template versioning
ALTER TABLE public.auto_reply_templates
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

CREATE TABLE IF NOT EXISTS public.auto_reply_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.auto_reply_templates(id) ON DELETE CASCADE,
  version int NOT NULL,
  name text NOT NULL,
  platform text NOT NULL,
  language text NOT NULL,
  template_text text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

GRANT SELECT ON public.auto_reply_template_versions TO authenticated;
GRANT ALL ON public.auto_reply_template_versions TO service_role;
ALTER TABLE public.auto_reply_template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versions readable by staff" ON public.auto_reply_template_versions;
CREATE POLICY "versions readable by staff" ON public.auto_reply_template_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer') OR public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

-- 3. Webhook delivery secrets in settings
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS cron_secret text;

-- 4. Outbound webhook delivery tracking (DLQ)
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS target_url text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS webhook_logs_retry_idx
  ON public.webhook_logs (processing_status, next_retry_at);
