create table if not exists public.training_jobs (
    id uuid primary key default gen_random_uuid(),
    status text not null check (status in ('running', 'completed', 'failed')),
    started_at timestamptz default now(),
    finished_at timestamptz,
    error_log text,
    created_at timestamptz default now()
);

grant select, insert, update, delete on public.training_jobs to authenticated;
grant all on public.training_jobs to service_role;

alter table public.training_jobs enable row level security;

create table if not exists public.training_versions (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    snapshot_data jsonb,
    created_at timestamptz default now()
);

grant select, insert, update, delete on public.training_versions to authenticated;
grant all on public.training_versions to service_role;

alter table public.training_versions enable row level security;

-- Add version_id to api_keys to track which training version a key uses
alter table public.api_keys add column if not exists version_id uuid references public.training_versions(id);

-- Add customizable settings for credit and API key overrides
alter table public.agent_settings add column if not exists lovable_api_key_override text;
alter table public.agent_settings add column if not exists credit_usage float default 0;

-- RLS policies for admin access to new tables
create policy "Admins can manage training jobs"
on public.training_jobs
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage training versions"
on public.training_versions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'));
