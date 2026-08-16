alter table public.agent_settings 
add column if not exists sync_token text,
add column if not exists sync_secret text;

grant select, update on public.agent_settings to authenticated;
grant all on public.agent_settings to service_role;
