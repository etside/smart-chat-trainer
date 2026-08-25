-- Migration: Add voice cloning settings columns
-- Run on existing VPS: psql -U daddyai -d daddyai -f scripts/migrate-voice-settings.sql

ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS fish_audio_model_id text,
  ADD COLUMN IF NOT EXISTS voice_provider varchar(10) DEFAULT 'fish';
