alter table public.agent_settings 
add column if not exists meta_api_version text default 'v19.0';
