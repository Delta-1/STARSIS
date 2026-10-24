create table public.startsys_accounts (
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 full_name text not null,
 password_hash text not null,
 created_at timestamptz not null default now()
);
create table public.startsys_sessions (
 token_hash text primary key,
 account_id uuid not null references public.startsys_accounts(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index startsys_sessions_account on public.startsys_sessions(account_id);
create index startsys_sessions_expiry on public.startsys_sessions(expires_at);
alter table public.startsys_accounts enable row level security;
alter table public.startsys_sessions enable row level security;
revoke all on public.startsys_accounts, public.startsys_sessions from anon, authenticated;
grant all on public.startsys_accounts, public.startsys_sessions to service_role;
