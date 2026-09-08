-- DaddyAI exports table (backup bundles with 24h TTL)
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle JSONB NOT NULL,
  label TEXT NOT NULL DEFAULT 'Backup',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS exports_expires_at_idx ON exports(expires_at);
CREATE INDEX IF NOT EXISTS exports_created_at_idx ON exports(created_at DESC);
