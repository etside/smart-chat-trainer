
-- 1. Auto-Reply Templates Table
CREATE TABLE public.auto_reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('messenger', 'whatsapp', 'instagram', 'web', 'all')),
    language TEXT NOT NULL CHECK (language IN ('en', 'bn', 'banglish')),
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_reply_templates TO authenticated;
GRANT ALL ON public.auto_reply_templates TO service_role;

ALTER TABLE public.auto_reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Editors can manage templates"
ON public.auto_reply_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Viewers can see templates"
ON public.auto_reply_templates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'));
