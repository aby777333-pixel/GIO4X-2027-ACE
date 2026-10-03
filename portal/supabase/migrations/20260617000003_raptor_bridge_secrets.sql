-- Private config for the raptor-trade-bridge edge function. RLS on with no
-- policies → only the service role (the function's injected key) can read.
-- Holds: raptor_url, raptor_service_key, bridge_secret. Values are inserted
-- out-of-band (never committed) — see the bridge runbook.
create table if not exists public.bridge_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.bridge_secrets enable row level security;
revoke all on public.bridge_secrets from anon, authenticated;
