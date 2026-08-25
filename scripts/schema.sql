-- =============================================================================
-- Combined PostgreSQL Schema for Smart Chat Trainer
-- Generated from Supabase migrations (2026-08-15 through 2026-08-25)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS vector; -- Requires pgvector installation

-- =============================================================================
-- SCHEMA: auth (local replacement for Supabase auth)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- Local replacement for Supabase's auth.users
CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    encrypted_password text NOT NULL DEFAULT '',
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    email_confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_sign_in_at timestamptz
);

-- Local replacement for Supabase's auth.sessions
CREATE TABLE auth.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL
);

-- =============================================================================
-- TYPES
-- =============================================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- =============================================================================
-- TABLES (in foreign-key order)
-- =============================================================================

-- user_roles
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- conversations
CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id text,
    source text NOT NULL DEFAULT 'import',
    channel text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- messages
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    seq integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- training_pairs
CREATE TABLE public.training_pairs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question text NOT NULL UNIQUE,
    answer text NOT NULL,
    context text,
    source text NOT NULL DEFAULT 'import',
    status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
    embedding jsonb,
    labels text[] DEFAULT '{}',
    language text DEFAULT 'bn',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- training_versions
CREATE TABLE IF NOT EXISTS public.training_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    snapshot_data jsonb,
    created_at timestamptz DEFAULT now()
);

-- sync_runs
CREATE TABLE IF NOT EXISTS public.sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL,
    items_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    source TEXT DEFAULT 'api_sync',
    idempotency_key TEXT UNIQUE,
    metadata JSONB DEFAULT '{}'
);

-- training_jobs
CREATE TABLE IF NOT EXISTS public.training_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    error_log text,
    sync_run_id uuid REFERENCES public.sync_runs(id),
    processed_count integer DEFAULT 0,
    retry_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- api_keys
CREATE TABLE public.api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    key_prefix text NOT NULL,
    revoked boolean NOT NULL DEFAULT false,
    last_used_at timestamptz,
    version_id uuid REFERENCES public.training_versions(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- agent_settings (single row, id=1)
CREATE TABLE public.agent_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    system_prompt text NOT NULL DEFAULT '',
    model text NOT NULL DEFAULT 'openai/gpt-5.6-sol',
    auto_approve boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    max_simultaneous_replies integer DEFAULT 5,
    enable_streaming boolean DEFAULT true,
    sync_schedule text DEFAULT 'daily',
    last_sync_at timestamptz,
    sync_token text,
    sync_secret text,
    meta_api_version text DEFAULT 'v19.0',
    meta_app_id text,
    meta_app_secret text,
    meta_access_token text,
    meta_page_id text,
    meta_whatsapp_business_account_id text,
    meta_webhook_verify_token text,
    reduce_motion boolean DEFAULT false,
    b2b_backblaze_key text,
    boson_workspace_id text,
    fish_audio_api_key text,
    alt_api_keys jsonb DEFAULT '{}',
    vps_hosting_config jsonb DEFAULT '{}',
    data_policy_content text DEFAULT '# Data Policy\n\nYour data policy content here...',
    last_sync_status varchar(50),
    last_sync_details jsonb DEFAULT '{}'::jsonb,
    lovable_api_key_override text,
    credit_usage float DEFAULT 0,
    usage_config jsonb DEFAULT '{
        "ai_message": {"credits": 1, "usd": 0.002, "bdt": 0.24},
        "lead_scoring": {"credits": 5, "usd": 0.01, "bdt": 1.20},
        "product_sync": {"credits": 10, "usd": 0.02, "bdt": 2.40}
    }'::jsonb,
    webhook_secret text,
    cron_secret text
);

-- webhook_logs
CREATE TABLE public.webhook_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL,
    event_type text,
    payload jsonb,
    headers jsonb,
    status_code integer,
    retry_count integer DEFAULT 0,
    next_retry_at timestamptz,
    error_details text,
    processing_status text DEFAULT 'success' CHECK (processing_status IN ('pending', 'success', 'failed', 'dead_letter')),
    direction text NOT NULL DEFAULT 'inbound',
    target_url text,
    last_attempt_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- usage_alerts
CREATE TABLE IF NOT EXISTS public.usage_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threshold_credits INTEGER NOT NULL,
    threshold_usd DECIMAL(10, 4) NOT NULL,
    threshold_bdt DECIMAL(10, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'monthly')),
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- notification_logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    metadata JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- performance_metrics
CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid DEFAULT gen_random_uuid(),
    action text NOT NULL,
    duration_ms integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- usage_logs
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

-- audit_logs
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- auto_reply_templates
CREATE TABLE public.auto_reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('messenger', 'whatsapp', 'instagram', 'web', 'all')),
    language TEXT NOT NULL CHECK (language IN ('en', 'bn', 'banglish')),
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    version int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- auto_reply_template_versions
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

-- tenant_credentials
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

-- canned_responses
CREATE TABLE IF NOT EXISTS canned_responses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    shortcut text,
    category text DEFAULT 'general',
    content text NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- conversation_sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id text,
    channel text DEFAULT 'web',
    customer_name text,
    customer_language text DEFAULT 'bn',
    status text DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated', 'archived')),
    assigned_agent text,
    summary text,
    message_count int DEFAULT 0,
    started_at timestamptz DEFAULT now(),
    last_message_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

-- session_messages
CREATE TABLE IF NOT EXISTS session_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text NOT NULL,
    channel text DEFAULT 'web',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- analytics_events
CREATE TABLE IF NOT EXISTS analytics_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type text NOT NULL,
    channel text,
    metric_value numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- conversation_flows
CREATE TABLE IF NOT EXISTS conversation_flows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    nodes jsonb DEFAULT '[]'::jsonb,
    edges jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT false,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO public.agent_settings (id, system_prompt) VALUES (1,
    'তুমি Wear Impressive (wearimpressive.com) নামের বাংলাদেশি অনলাইন ফ্যাশন পেজের কাস্টমার সাপোর্ট এজেন্ট। তুমি ঠিক যেভাবে পেজের এডমিন আগে উত্তর দিত সেভাবেই ছোট, বন্ধুত্বপূর্ণ, বাংলা/বাংলিশ মিশিয়ে উত্তর দিবে। দাম, সাইজ, ফেব্রিক, ডেলিভারি চার্জ (ঢাকা সিটি ৭০ টাকা, সাভার-কেরানীগঞ্জ-গাজীপুর-ধামরাই ১২০ টাকা, ঢাকার বাইরে ১৫০ টাকা) সম্পর্কে দেওয়া উদাহরণ অনুযায়ী উত্তর দিবে। যা জানো না তা বানিয়ে বলবে না।')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX conversations_source_idx ON public.conversations(source);
CREATE INDEX conversations_external_idx ON public.conversations(external_id);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, seq);
CREATE INDEX training_pairs_status_idx ON public.training_pairs(status);
CREATE INDEX training_pairs_created_idx ON public.training_pairs(created_at DESC);
CREATE INDEX training_pairs_q_trgm ON public.training_pairs USING gin (question gin_trgm_ops);
CREATE INDEX training_pairs_labels ON public.training_pairs USING gin(labels);
CREATE INDEX webhook_logs_retry_idx ON public.webhook_logs(processing_status, next_retry_at) WHERE processing_status = 'pending';
CREATE INDEX idx_session_messages_session ON session_messages(session_id, created_at);
CREATE INDEX idx_conversations_sessions_status ON conversation_sessions(status, channel);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type, created_at);

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW knowledge_base_articles AS
SELECT
    id,
    question AS title,
    answer AS content,
    labels,
    created_at
FROM training_pairs
WHERE status = 'approved'
ORDER BY created_at DESC;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- has_role: role hierarchy check (admin > editor > viewer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
    actual_role public.app_role;
BEGIN
    SELECT role INTO actual_role FROM public.user_roles WHERE user_id = _user_id;

    IF actual_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Hierarchy: admin > editor > viewer
    IF _role = 'admin' THEN
        RETURN actual_role = 'admin';
    ELSIF _role = 'editor' THEN
        RETURN actual_role IN ('admin', 'editor');
    ELSIF _role = 'viewer' THEN
        RETURN actual_role IN ('admin', 'editor', 'viewer');
    ELSE
        RETURN TRUE;
    END IF;
END;
$$;

-- handle_new_user: auto-assign admin to owner on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF lower(NEW.email) = 'aniktonmoybd@gmail.com' THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

-- set_updated_at: auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- search_training_pairs: full-text search using pg_trgm similarity
CREATE OR REPLACE FUNCTION public.search_training_pairs(_query text, _limit integer DEFAULT 8)
RETURNS TABLE (id uuid, question text, answer text, score real)
LANGUAGE sql STABLE AS $$
    SELECT tp.id, tp.question, tp.answer, similarity(tp.question, _query) AS score
    FROM public.training_pairs tp
    WHERE tp.status = 'approved' AND tp.question % _query
    ORDER BY score DESC
    LIMIT LEAST(COALESCE(_limit, 8), 25)
$$;

-- search_training_pairs_semantic: vector similarity search (requires pgvector extension)
-- Install pgvector first: -- CREATE EXTENSION IF NOT EXISTS vector; -- Requires pgvector installation
-- Then uncomment and change embedding column type to vector(1536)
-- CREATE OR REPLACE FUNCTION search_training_pairs_semantic(
--     _embedding vector(1536),
--     _limit int DEFAULT 8
-- )
-- RETURNS TABLE (question text, answer text, score real, id uuid)
-- LANGUAGE sql STABLE AS $$
--     SELECT tp.question, tp.answer,
--            1 - (tp.embedding <=> _embedding) AS score, tp.id
--     FROM training_pairs tp
--     WHERE tp.status = 'approved' AND tp.embedding IS NOT NULL
--     ORDER BY tp.embedding <=> _embedding LIMIT _limit;
-- $$;

-- log_audit: insert an audit log entry
CREATE OR REPLACE FUNCTION public.log_audit(
    _actor_id UUID,
    _action TEXT,
    _entity_type TEXT,
    _entity_id UUID,
    _metadata JSONB
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (_actor_id, _action, _entity_type, _entity_id, _metadata);
END;
$$;

-- get_usage_aggregates: total credits/cost across all usage logs
CREATE OR REPLACE FUNCTION public.get_usage_aggregates()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_credits', COALESCE(SUM(credits_used), 0),
        'total_usd', COALESCE(SUM(cost_usd), 0),
        'total_bdt', COALESCE(SUM(cost_bdt), 0),
        'count', COUNT(*)
    ) INTO result
    FROM public.usage_logs;

    RETURN result;
END;
$$;

-- increment_agent_credits: add credits to agent_settings.credit_usage
CREATE OR REPLACE FUNCTION public.increment_agent_credits(amount NUMERIC)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.agent_settings
    SET credit_usage = COALESCE(credit_usage, 0) + amount
    WHERE id = 1;
END;
$$;

-- check_usage_thresholds: evaluate daily/monthly alerts and insert notifications
CREATE OR REPLACE FUNCTION public.check_usage_thresholds()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    daily_stats JSONB;
    monthly_stats JSONB;
    alert_row RECORD;
BEGIN
    -- Get daily stats
    SELECT jsonb_build_object(
        'credits', COALESCE(SUM(credits_used), 0),
        'usd', COALESCE(SUM(cost_usd), 0),
        'bdt', COALESCE(SUM(cost_bdt), 0)
    ) INTO daily_stats
    FROM usage_logs
    WHERE created_at >= CURRENT_DATE;

    -- Get monthly stats
    SELECT jsonb_build_object(
        'credits', COALESCE(SUM(credits_used), 0),
        'usd', COALESCE(SUM(cost_usd), 0),
        'bdt', COALESCE(SUM(cost_bdt), 0)
    ) INTO monthly_stats
    FROM usage_logs
    WHERE created_at >= date_trunc('month', CURRENT_DATE);

    -- Check daily alerts
    FOR alert_row IN SELECT * FROM usage_alerts WHERE type = 'daily' AND is_active = true LOOP
        IF (daily_stats->>'credits')::int >= alert_row.threshold_credits OR
           (daily_stats->>'usd')::decimal >= alert_row.threshold_usd OR
           (daily_stats->>'bdt')::decimal >= alert_row.threshold_bdt THEN

            IF alert_row.last_triggered_at IS NULL OR alert_row.last_triggered_at < CURRENT_DATE THEN
                INSERT INTO notification_logs (title, message, type, metadata)
                VALUES (
                    'Daily usage limit exceeded',
                    format('Your daily limit (%s credits / $%s) has been exceeded. Current usage: %s credits / $%s',
                        alert_row.threshold_credits, alert_row.threshold_usd,
                        daily_stats->>'credits', daily_stats->>'usd'),
                    'usage_alert',
                    daily_stats
                );

                UPDATE usage_alerts SET last_triggered_at = NOW() WHERE id = alert_row.id;
            END IF;
        END IF;
    END LOOP;

    -- Check monthly alerts
    FOR alert_row IN SELECT * FROM usage_alerts WHERE type = 'monthly' AND is_active = true LOOP
        IF (monthly_stats->>'credits')::int >= alert_row.threshold_credits OR
           (monthly_stats->>'usd')::decimal >= alert_row.threshold_usd OR
           (monthly_stats->>'bdt')::decimal >= alert_row.threshold_bdt THEN

            IF alert_row.last_triggered_at IS NULL OR alert_row.last_triggered_at < date_trunc('month', CURRENT_DATE) THEN
                INSERT INTO notification_logs (title, message, type, metadata)
                VALUES (
                    'Monthly usage limit exceeded',
                    format('Your monthly limit (%s credits / $%s) has been exceeded. Current usage: %s credits / $%s',
                        alert_row.threshold_credits, alert_row.threshold_usd,
                        monthly_stats->>'credits', monthly_stats->>'usd'),
                    'usage_alert',
                    monthly_stats
                );

                UPDATE usage_alerts SET last_triggered_at = NOW() WHERE id = alert_row.id;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- get_analytics_summary: aggregate analytics for a given day range
CREATE OR REPLACE FUNCTION get_analytics_summary(
    _days int DEFAULT 30
)
RETURNS TABLE (
    total_conversations bigint,
    total_messages bigint,
    channel_breakdown jsonb,
    top_questions jsonb,
    avg_messages_per_conversation numeric,
    response_accuracy numeric
)
LANGUAGE sql STABLE AS $$
    WITH
    conv_stats AS (
        SELECT count(*) as total_conversations
        FROM conversation_sessions
        WHERE started_at > now() - make_interval(days => _days)
    ),
    msg_stats AS (
        SELECT count(*) as total_messages
        FROM session_messages sm
        JOIN conversation_sessions cs ON sm.session_id = cs.id
        WHERE sm.created_at > now() - make_interval(days => _days)
    ),
    channels AS (
        SELECT jsonb_object_agg(channel, cnt) as channel_breakdown
        FROM (
            SELECT channel, count(*) as cnt
            FROM conversation_sessions
            WHERE started_at > now() - make_interval(days => _days)
            GROUP BY channel
        ) sub
    ),
    top_q AS (
        SELECT jsonb_agg(jsonb_build_object('question', question, 'count', cnt)) as top_questions
        FROM (
            SELECT question, count(*) as cnt
            FROM training_pairs
            WHERE status = 'approved'
            GROUP BY question
            ORDER BY cnt DESC
            LIMIT 10
        ) sub
    ),
    avg_msgs AS (
        SELECT coalesce(avg(message_count), 0) as avg_messages_per_conversation
        FROM conversation_sessions
        WHERE started_at > now() - make_interval(days => _days)
    ),
    accuracy AS (
        SELECT coalesce(
            (SELECT count(*) FROM training_pairs WHERE status = 'approved')::numeric /
            NULLIF((SELECT count(*) FROM training_pairs)::numeric, 0) * 100,
            0
        ) as response_accuracy
    )
    SELECT
        cs.total_conversations,
        ms.total_messages,
        ch.channel_breakdown,
        tq.top_questions,
        am.avg_messages_per_conversation,
        ac.response_accuracy
    FROM conv_stats cs, msg_stats ms, channels ch, top_q tq, avg_msgs am, accuracy ac;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-assign admin role on user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on training_pairs
CREATE TRIGGER training_pairs_updated
    BEFORE UPDATE ON public.training_pairs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- DONE
-- =============================================================================
