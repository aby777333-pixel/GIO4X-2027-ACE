-- §24 Configuration: broker-editable account types (plans). Seeded from the
-- former hardcoded ACCOUNT_TYPES constant so behaviour is unchanged at launch.
-- Public-authenticated read (clients pick a plan when opening an account),
-- admin-only write. Consumers fall back to the constant if this is empty.

create table if not exists public.account_types (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  leverage      integer not null default 500,
  min_deposit   numeric not null default 0,
  base_currency text not null default 'USD',
  spread_from   text,
  commission    text,
  sort          integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.account_types enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='account_types' and policyname='account_types_read') then
    create policy account_types_read on public.account_types for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='account_types' and policyname='account_types_admin') then
    create policy account_types_admin on public.account_types for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

grant select on public.account_types to anon, authenticated;
grant insert, update, delete on public.account_types to authenticated;

insert into public.account_types (name, leverage, min_deposit, base_currency, spread_from, commission, sort) values
  ('Classic',       500, 150,  'USD', '2.5 pips', 'None',       1),
  ('Premium',       500, 500,  'USD', '1.5 pips', 'None',       2),
  ('ECN',           500, 2000, 'USD', '0.2 pips', '$3.50/lot',  3),
  ('Cent',          500, 50,   'USD', '2.0 pips', 'None',       4),
  ('Swap-Free STP', 500, 200,  'USD', '1.8 pips', 'None',       5)
on conflict (name) do nothing;
