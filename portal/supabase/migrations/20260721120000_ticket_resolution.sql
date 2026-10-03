-- §22 Service desk: dispute resolution + CSAT on support tickets.
-- Additive, nullable columns only — no data loss, no policy change (the existing
-- row-level staff update policy already covers these columns).

alter table public.support_tickets
  add column if not exists resolution_code text,
  add column if not exists resolution_note text,
  add column if not exists resolved_at   timestamptz,
  add column if not exists csat_score    smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_csat_range'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_csat_range
      check (csat_score is null or csat_score between 1 and 5);
  end if;
end $$;

comment on column public.support_tickets.resolution_code is 'Set when a ticket is resolved/closed — how it was resolved (see app RESOLUTION_CODES).';
comment on column public.support_tickets.resolved_at is 'Timestamp the ticket first moved to resolved/closed — drives time-to-resolution reporting.';
comment on column public.support_tickets.csat_score is 'Optional 1-5 customer satisfaction score after resolution.';
