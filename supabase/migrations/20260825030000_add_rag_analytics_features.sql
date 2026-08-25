-- Daddy AI Phase P0/P1/P2 Feature Migration
-- Adds: pgvector embeddings, canned responses, labels, analytics, knowledge base, flow builder, sessions

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to training_pairs for RAG
ALTER TABLE training_pairs ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE training_pairs ADD COLUMN IF NOT EXISTS labels text[] DEFAULT '{}';
ALTER TABLE training_pairs ADD COLUMN IF NOT EXISTS language text DEFAULT 'bn';

-- 3. Canned response templates
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

-- 4. Conversation sessions (multi-turn memory)
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

-- 5. Session messages (linked to sessions)
CREATE TABLE IF NOT EXISTS session_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  channel text DEFAULT 'web',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 6. Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  channel text,
  metric_value numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 7. Conversation flow nodes
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

-- 8. Knowledge base articles (public view of approved training pairs)
CREATE OR REPLACE VIEW knowledge_base_articles AS
SELECT
  id,
  question as title,
  answer as content,
  labels,
  created_at
FROM training_pairs
WHERE status = 'approved'
ORDER BY created_at DESC;

-- 9. Session index
CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_sessions_status ON conversation_sessions(status, channel);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_training_pairs_labels ON training_pairs USING gin(labels);

-- 10. Semantic search function using pgvector
CREATE OR REPLACE FUNCTION search_training_pairs_semantic(
  _embedding vector(1536),
  _limit int DEFAULT 8
)
RETURNS TABLE (
  question text,
  answer text,
  score real,
  id uuid
)
LANGUAGE sql STABLE
AS $$
  SELECT
    tp.question,
    tp.answer,
    1 - (tp.embedding <=> _embedding) AS score,
    tp.id
  FROM training_pairs tp
  WHERE tp.status = 'approved'
    AND tp.embedding IS NOT NULL
  ORDER BY tp.embedding <=> _embedding
  LIMIT _limit;
$$;

-- 11. Analytics aggregation function
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
LANGUAGE sql STABLE
AS $$
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
