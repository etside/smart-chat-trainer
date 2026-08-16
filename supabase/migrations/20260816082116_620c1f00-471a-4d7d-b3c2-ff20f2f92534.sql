ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS reduce_motion boolean DEFAULT false;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS b2b_backblaze_key text;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS boson_workspace_id text;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS fish_audio_api_key text;
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS alt_api_keys jsonb DEFAULT '{}';
ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS vps_hosting_config jsonb DEFAULT '{}';