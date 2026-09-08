-- Add new fields to canned_responses for full feature set
ALTER TABLE public.canned_responses
  ADD COLUMN IF NOT EXISTS template_text text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS platform text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'both';

-- Migrate existing content -> template_text for any rows that have content but no template_text
UPDATE public.canned_responses
  SET template_text = content
  WHERE template_text IS NULL AND content IS NOT NULL;

-- Add check constraints
ALTER TABLE public.canned_responses
  DROP CONSTRAINT IF EXISTS canned_responses_platform_check;
ALTER TABLE public.canned_responses
  ADD CONSTRAINT canned_responses_platform_check
  CHECK (platform IN ('messenger', 'whatsapp', 'instagram', 'all'));

ALTER TABLE public.canned_responses
  DROP CONSTRAINT IF EXISTS canned_responses_language_check;
ALTER TABLE public.canned_responses
  ADD CONSTRAINT canned_responses_language_check
  CHECK (language IN ('bn', 'en', 'both'));
