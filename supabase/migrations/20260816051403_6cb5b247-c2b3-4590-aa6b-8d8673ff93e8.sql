alter table public.agent_settings 
add column if not exists meta_app_id text,
add column if not exists meta_app_secret text,
add column if not exists meta_access_token text,
add column if not exists meta_page_id text,
add column if not exists meta_whatsapp_business_account_id text,
add column if not exists meta_webhook_verify_token text;

grant select, update on public.agent_settings to authenticated;
grant all on public.agent_settings to service_role;