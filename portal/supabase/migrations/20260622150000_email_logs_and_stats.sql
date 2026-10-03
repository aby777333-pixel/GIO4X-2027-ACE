-- Audit log for the staff Bulk Emailer + real stats for the dashboard cards.
create table if not exists public.email_logs (
  id               uuid primary key default gen_random_uuid(),
  sent_by          uuid references auth.users(id) on delete set null,
  recipients       text[] not null,
  subject          text not null,
  body             text,
  attachment_names text[] not null default '{}',
  template_id      text,
  status           text not null default 'sent',   -- sent | partial | failed | scheduled
  scheduled_for    timestamptz,
  sent_count       integer not null default 0,
  failed_count     integer not null default 0,
  error_message    text,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create index if not exists email_logs_created_idx on public.email_logs (created_at desc);

alter table public.email_logs enable row level security;

drop policy if exists email_logs_staff_read on public.email_logs;
create policy email_logs_staff_read on public.email_logs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

drop policy if exists email_logs_staff_insert on public.email_logs;
create policy email_logs_staff_insert on public.email_logs for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

grant select, insert on public.email_logs to authenticated;

create or replace function public.emailer_stats()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')) then
    return '{}'::jsonb;
  end if;
  select jsonb_build_object(
    'sent_month',    coalesce((select sum(sent_count)   from email_logs where created_at >= date_trunc('month', now())), 0),
    'sent_total',    coalesce((select sum(sent_count)   from email_logs), 0),
    'failed_total',  coalesce((select sum(failed_count) from email_logs), 0),
    'batches_month', coalesce((select count(*)          from email_logs where created_at >= date_trunc('month', now())), 0)
  ) into v;
  return v;
end; $$;

revoke all on function public.emailer_stats() from public, anon;
grant execute on function public.emailer_stats() to authenticated;
