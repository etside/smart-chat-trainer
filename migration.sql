create table if not exists public.training_jobs (
    id uuid primary key default gen_random_uuid(),
    status text not null,
    started_at timestamptz default now(),
    finished_at timestamptz,
    error_log text
);
grant select, insert, update, delete on public.training_jobs to authenticated;
grant all on public.training_jobs to service_role;
alter table public.training_jobs enable row level security;

create table if not exists public.training_versions (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz default now()
);
grant select, insert, update, delete on public.training_versions to authenticated;
grant all on public.training_versions to service_role;
alter table public.training_versions enable row level security;

alter table public.agent_settings add column if not exists lovable_api_key_override text;
