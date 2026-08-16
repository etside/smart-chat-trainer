-- 1. Create a temporary table with unique questions
CREATE TEMP TABLE unique_pairs AS
SELECT DISTINCT ON (question) *
FROM public.training_pairs
ORDER BY question, created_at DESC;

-- 2. Clear the original table
DELETE FROM public.training_pairs;

-- 3. Restore unique records
INSERT INTO public.training_pairs
SELECT * FROM unique_pairs;

-- 4. Add the unique constraint
ALTER TABLE public.training_pairs ADD CONSTRAINT training_pairs_question_key UNIQUE (question);
