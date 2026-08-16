ALTER TABLE public.training_jobs 
ADD COLUMN IF NOT EXISTS processed_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
