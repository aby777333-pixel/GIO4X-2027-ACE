-- §24 Configuration: broker-editable legal documents (terms, risk disclosure,
-- privacy, consent). Public can read only PUBLISHED docs; admins write. Seeded
-- UNPUBLISHED with placeholders so no fake legal text is ever shown as real —
-- the broker writes and publishes the actual content in Configuration → Legal.

create table if not exists public.legal_documents (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  title      text not null,
  body       text not null default '',
  version    integer not null default 1,
  published  boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.legal_documents enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='legal_documents' and policyname='legal_read') then
    create policy legal_read on public.legal_documents for select using (published = true);
  end if;
  if not exists (select 1 from pg_policies where tablename='legal_documents' and policyname='legal_admin') then
    create policy legal_admin on public.legal_documents for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

grant select on public.legal_documents to anon, authenticated;
grant insert, update, delete on public.legal_documents to authenticated;

insert into public.legal_documents (key, title, body, published) values
  ('terms',           'Terms of Service',   '[Draft — edit and publish your Terms of Service in Configuration → Legal.]', false),
  ('risk_disclosure', 'Risk Disclosure',    '[Draft — edit and publish your Risk Disclosure in Configuration → Legal.]', false),
  ('privacy',         'Privacy Policy',      '[Draft — edit and publish your Privacy Policy in Configuration → Legal.]', false)
on conflict (key) do nothing;
