create table public.startsys_companies (
 id uuid primary key default gen_random_uuid(),
 owner_id text not null unique,
 name text not null check (length(name) between 2 and 120),
 settings jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.startsys_records (
 id text primary key,
 company_id uuid not null references public.startsys_companies(id) on delete cascade,
 kind text not null,
 data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index startsys_records_company_kind on public.startsys_records(company_id,kind,updated_at desc);
create index startsys_records_contact on public.startsys_records(company_id,kind,(data->>'contactId'),created_at desc);
alter table public.startsys_companies enable row level security;
alter table public.startsys_records enable row level security;
revoke all on public.startsys_companies, public.startsys_records from anon, authenticated;
grant all on public.startsys_companies, public.startsys_records to service_role;
