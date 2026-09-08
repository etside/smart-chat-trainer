-- Migration: Add auto_reply_mode column to agent_settings
-- Run this in your Supabase SQL editor

ALTER TABLE agent_settings
ADD COLUMN IF NOT EXISTS auto_reply_mode TEXT DEFAULT 'off'
CHECK (auto_reply_mode IN ('on', 'off', 'standby'));

COMMENT ON COLUMN agent_settings.auto_reply_mode IS 'Controls AI auto-reply behavior: on=auto-reply, off=no replies, standby=draft for approval';
