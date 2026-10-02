-- =============================================================================
-- GIO4X · 0005_crm · pipeline stage, lead score, follow-up tasks
-- -----------------------------------------------------------------------------
-- Apply after 0004. Re-runnable.
--
-- Two different questions about an enquiry are now kept apart:
--   status  where the CONVERSATION is   new · open · waiting · resolved · spam
--   stage   where the RELATIONSHIP is   enquiry · contacted · qualified ·
--                                       applying · client · lost
--
-- score is a number from 0 to 100 computed by the database from facts already
-- on the row (topic, account interest, phone, country, consent, campaign). It
-- is a GENERATED column: nobody can set it, it cannot go stale, and the console
-- shows the same rules beside it (src/components/control/score.ts). It orders
-- work; it says nothing about the person.
--
-- lead_tasks are follow-ups: one line, a due time, an owner, done or not.
-- =============================================================================

do $guard$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles r
    where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)
  ) then
    raise exception
      'GIO4X migrations must be applied by a role with BYPASSRLS (on Supabase: postgres). Current role: %', current_user;
  end if;
end
$guard$;

-- ---------------------------------------------------------------------------
-- leads: stage, lost reason, score.
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists stage text not null default 'enquiry';
alter table public.leads add column if not exists stage_changed_at timestamptz;
alter table public.leads add column if not exists lost_reason text;

alter table public.leads drop constraint if exists leads_stage_valid;
alter table public.leads add constraint leads_stage_valid check (
  stage in ('enquiry', 'contacted', 'qualified', 'applying', 'client', 'lost')
);
alter table public.leads drop constraint if exists leads_lost_reason_valid;
alter table public.leads add constraint leads_lost_reason_valid check (
  lost_reason is null
  or lost_reason in ('no_response', 'not_eligible', 'chose_another', 'not_interested', 'duplicate', 'other')
);
-- a lost enquiry always says why; any other stage never carries a reason
alter table public.leads drop constraint if exists leads_lost_reason_when_lost;
alter table public.leads add constraint leads_lost_reason_when_lost check ((stage = 'lost') = (lost_reason is not null));

-- Must equal scoreParts() in src/components/control/score.ts.
alter table public.leads add column if not exists score smallint generated always as (
  (case
    when topic in ('Complaint', 'Press', 'Privacy', 'Security', 'Technical') then 0
    else
      (case topic
        when 'Account opening' then 40
        when 'Partnership' then 30
        when 'Account' then 20
        when 'Platform: 777 Raptor' then 15
        when 'Platform: MetaTrader 5' then 15
        else 10
      end)
      + (case when account_interest is not null then 20 else 0 end)
      + (case when phone is not null then 15 else 0 end)
      + (case when country is not null then 5 else 0 end)
      + (case when marketing_consent then 10 else 0 end)
      + (case when utm <> '{}'::jsonb then 10 else 0 end)
  end)::smallint
) stored;

create index if not exists leads_stage_created_at_idx on public.leads (stage, created_at desc);

-- staff may now also move the stage (rows still limited by leads_staff_update)
grant update (stage, lost_reason) on public.leads to authenticated;

create or replace function public.leads_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  new.updated_at := now();

  if actor is not null
     and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is not null
     and new.assigned_to <> actor
     and not (select public.staff_can('leads.assign'))
  then
    raise exception 'Only an admin may assign a lead to another member of staff'
      using errcode = '42501';
  end if;

  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  else
    new.stage_changed_at := old.stage_changed_at;
  end if;
  -- leaving "lost" clears the reason, so the caller never has to send a null
  if new.stage <> 'lost' then
    new.lost_reason := null;
  end if;

  return new;
end;
$$;

create or replace function public.leads_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (
      (select auth.uid()), 'lead.status', 'lead', new.id::text,
      jsonb_build_object('reference', new.reference, 'from', old.status, 'to', new.status)
    );
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (
      (select auth.uid()), 'lead.assign', 'lead', new.id::text,
      jsonb_build_object('reference', new.reference, 'from', old.assigned_to, 'to', new.assigned_to)
    );
  end if;

  if new.stage is distinct from old.stage or new.lost_reason is distinct from old.lost_reason then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (
      (select auth.uid()), 'lead.stage', 'lead', new.id::text,
      jsonb_build_object('reference', new.reference, 'from', old.stage, 'to', new.stage)
        || case when new.lost_reason is not null then jsonb_build_object('reason', new.lost_reason) else '{}'::jsonb end
    );
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- lead_tasks: follow-ups on an enquiry.
-- `created_by`, `done_at` and `done_by` are never supplied by a caller.
-- ---------------------------------------------------------------------------
create table if not exists public.lead_tasks (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  assigned_to uuid default auth.uid() references public.staff (user_id) on delete set null,
  title       text not null,
  due_at      timestamptz not null,
  done        boolean not null default false,
  done_at     timestamptz,
  done_by     uuid,
  constraint lead_tasks_title_valid check (
    char_length(title) between 1 and 200
    and char_length(btrim(title)) >= 1
    and title !~ '[\u0001-\u001F\u007F]'
  ),
  -- a follow-up is for the near future: not long past, not years away
  constraint lead_tasks_due_valid check (
    due_at >= created_at - interval '1 day' and due_at <= created_at + interval '3 years'
  ),
  constraint lead_tasks_done_evidence check (done = (done_at is not null))
);
comment on table public.lead_tasks is 'Follow-up tasks on a lead. Staff only.';

alter table public.lead_tasks enable row level security;
alter table public.lead_tasks force row level security;
revoke all on table public.lead_tasks from public, anon, authenticated;

create index if not exists lead_tasks_lead_idx on public.lead_tasks (lead_id, due_at);
create index if not exists lead_tasks_open_idx on public.lead_tasks (assigned_to, due_at) where not done;

grant select on public.lead_tasks to authenticated;
grant insert (lead_id, title, due_at, assigned_to) on public.lead_tasks to authenticated;
grant update (done) on public.lead_tasks to authenticated;

drop policy if exists lead_tasks_select on public.lead_tasks;
create policy lead_tasks_select on public.lead_tasks
  for select
  to authenticated
  using ((select public.staff_can('leads.read')));

-- a task is created as oneself, and for oneself unless the caller may assign
drop policy if exists lead_tasks_insert on public.lead_tasks;
create policy lead_tasks_insert on public.lead_tasks
  for insert
  to authenticated
  with check (
    (select public.staff_can('tasks.write'))
    and created_by = (select auth.uid())
    and not done
    and (assigned_to = (select auth.uid()) or (select public.staff_can('leads.assign')))
  );

drop policy if exists lead_tasks_update on public.lead_tasks;
create policy lead_tasks_update on public.lead_tasks
  for update
  to authenticated
  using ((select public.staff_can('tasks.write')))
  with check ((select public.staff_can('tasks.write')));

create or replace function public.lead_tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce((select auth.role()), '') in ('anon', 'authenticated') then
      new.created_at := now();
      new.created_by := (select auth.uid());
    end if;
    new.done := false;
    new.done_at := null;
    new.done_by := null;
  else
    if new.done is distinct from old.done then
      if new.done then
        new.done_at := now();
        new.done_by := (select auth.uid());
      else
        new.done_at := null;
        new.done_by := null;
      end if;
    else
      new.done_at := old.done_at;
      new.done_by := old.done_by;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.lead_tasks_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (coalesce((select auth.uid()), new.created_by), 'lead.task', 'lead', new.lead_id::text,
            jsonb_build_object('task_id', new.id, 'assigned_to', new.assigned_to));
  elsif new.done is distinct from old.done then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values ((select auth.uid()), case when new.done then 'lead.task_done' else 'lead.task_reopened' end,
            'lead', new.lead_id::text, jsonb_build_object('task_id', new.id));
  end if;
  return null;
end;
$$;

drop trigger if exists lead_tasks_before_write on public.lead_tasks;
create trigger lead_tasks_before_write
  before insert or update on public.lead_tasks
  for each row execute function public.lead_tasks_before_write();

drop trigger if exists lead_tasks_after_write on public.lead_tasks;
create trigger lead_tasks_after_write
  after insert or update on public.lead_tasks
  for each row execute function public.lead_tasks_after_write();

revoke all on function public.lead_tasks_before_write() from public, anon, authenticated;
revoke all on function public.lead_tasks_after_write() from public, anon, authenticated;
