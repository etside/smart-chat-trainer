-- ============================================================
-- Daddy AI: Sentiment Analysis, Lead Scoring & Human Diversion
-- Migration: Add tables for AI sales agent capabilities
-- ============================================================

-- 1. Lead scores table - tracks qualification score per conversation
CREATE TABLE IF NOT EXISTS public.lead_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    session_id uuid REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
    external_id text,
    score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    tier text NOT NULL DEFAULT 'cold' CHECK (tier IN ('cold', 'warm', 'hot', 'qualified', 'escalated')),
    signals jsonb DEFAULT '[]'::jsonb,
    last_evaluated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_scores_session ON public.lead_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_tier ON public.lead_scores(tier);
CREATE INDEX IF NOT EXISTS idx_lead_scores_external ON public.lead_scores(external_id);
GRANT SELECT, INSERT, UPDATE ON public.lead_scores TO authenticated;
GRANT ALL ON public.lead_scores TO service_role;

-- 2. Sentiment logs - per-message sentiment analysis results
CREATE TABLE IF NOT EXISTS public.sentiment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    session_id uuid REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
    message_id uuid,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text,
    sentiment text NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')),
    sentiment_score numeric(3,2) DEFAULT 0.0 CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0),
    emotions jsonb DEFAULT '[]'::jsonb,
    urgency text DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sentiment_session ON public.sentiment_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_conversation ON public.sentiment_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_urgency ON public.sentiment_logs(urgency);
GRANT SELECT, INSERT ON public.sentiment_logs TO authenticated;
GRANT ALL ON public.sentiment_logs TO service_role;

-- 3. Escalation queue - conversations diverted to human agents
CREATE TABLE IF NOT EXISTS public.escalation_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    session_id uuid REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
    external_id text,
    channel text DEFAULT 'api',
    reason text NOT NULL,
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    lead_score integer DEFAULT 0,
    sentiment_summary jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'dismissed')),
    assigned_to text,
    resolved_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escalation_status ON public.escalation_queue(status);
CREATE INDEX IF NOT EXISTS idx_escalation_priority ON public.escalation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_escalation_pending ON public.escalation_queue(status, priority) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE ON public.escalation_queue TO authenticated;
GRANT ALL ON public.escalation_queue TO service_role;

-- 4. Conversation sessions enhancements
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS sentiment_avg numeric(3,2) DEFAULT 0.0;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS escalation_status text DEFAULT 'none' CHECK (escalation_status IN ('none', 'pending', 'escalated', 'resolved'));
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS last_sentiment text DEFAULT 'neutral';
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS message_count integer DEFAULT 0;

-- 5. Agent settings enhancements for AI sales config
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS sentiment_enabled boolean DEFAULT true;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS lead_score_threshold integer DEFAULT 70;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS auto_escalate boolean DEFAULT true;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS max_concurrent_conversations integer DEFAULT 15;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS escalation_webhook_url text;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS human_takeover_message text DEFAULT 'আমি এখন একজন মানুষের সাথে সংযুক্ত করছি। অনুগ্রহ করে একটু অপেক্ষা করুন।';

-- 6. Performance indexes for concurrency
CREATE INDEX IF NOT EXISTS idx_conversations_external ON public.conversations(external_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq ON public.messages(conversation_id, seq);
CREATE INDEX IF NOT EXISTS idx_session_messages_session ON public.session_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action_created ON public.usage_logs(action, created_at);
