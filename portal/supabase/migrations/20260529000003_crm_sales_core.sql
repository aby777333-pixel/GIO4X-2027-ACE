-- ============================================================================
-- 20260529000003_crm_sales_core.sql
-- Phase 0 foundation (event outbox + feature flags) and the Sales-CRM core
-- (leads, lead activity timeline, follow-up tasks).
--
-- ADDITIVE ONLY. Reuses the existing is_staff()/is_admin() RLS helpers and the
-- log_audit() trigger from 20260528000001_giorapter_ecosystem_foundation.sql.
-- No existing table, type, policy, or function is altered or dropped.
--
-- Leads here are PRE-AUTH prospects (web forms, ad lead-gen, manual entry) and
-- therefore do NOT reference auth.users — distinct from crm_profiles, which
-- decorates an already-registered profile. On conversion a lead is linked to a
-- profiles row via converted_profile_id.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums (guarded so the migration is safe to re-run)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.crm_lead_stage AS ENUM
    ('new','contacted','qualified','proposal','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_lead_status AS ENUM
    ('open','converted','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_activity_kind AS ENUM
    ('note','call','email','whatsapp','sms','meeting','stage_change','assignment','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_task_status AS ENUM
    ('open','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Phase 0: event outbox (decouples modules; drained by service-role workers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events_outbox (
  id           uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  topic        text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attempts     integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_outbox_unprocessed_idx
  ON public.events_outbox (created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS events_outbox_topic_idx
  ON public.events_outbox (topic);

-- ---------------------------------------------------------------------------
-- Phase 0: feature flags (DB-backed gates for modules / white-labels)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Sales CRM: leads (prospects, pre-conversion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id                   uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  full_name            text NOT NULL DEFAULT '',
  email                citext,
  phone                text,
  country              text,
  source               text NOT NULL DEFAULT 'manual',
  campaign             text,
  utm                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage                public.crm_lead_stage  NOT NULL DEFAULT 'new',
  status               public.crm_lead_status NOT NULL DEFAULT 'open',
  score                integer NOT NULL DEFAULT 0,
  assigned_staff       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code        text,
  owner_notes          text NOT NULL DEFAULT '',
  lost_reason          text,
  converted_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_activity_at     timestamptz NOT NULL DEFAULT now(),
  next_follow_up_at    timestamptz,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_leads_stage_idx        ON public.crm_leads (stage);
CREATE INDEX IF NOT EXISTS crm_leads_status_idx       ON public.crm_leads (status);
CREATE INDEX IF NOT EXISTS crm_leads_assigned_idx     ON public.crm_leads (assigned_staff);
CREATE INDEX IF NOT EXISTS crm_leads_email_idx        ON public.crm_leads (email);
CREATE INDEX IF NOT EXISTS crm_leads_created_idx      ON public.crm_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_follow_up_idx    ON public.crm_leads (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Sales CRM: append-only activity timeline per lead
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_lead_activities (
  id         uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind       public.crm_activity_kind NOT NULL DEFAULT 'note',
  body       text NOT NULL DEFAULT '',
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_lead_activities_lead_idx
  ON public.crm_lead_activities (lead_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Sales CRM: follow-up tasks (can hang off a lead or a converted client)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id           uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title        text NOT NULL,
  lead_id      uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  client_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority     public.ticket_priority NOT NULL DEFAULT 'normal',
  status       public.crm_task_status NOT NULL DEFAULT 'open',
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_tasks_assigned_idx ON public.crm_tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS crm_tasks_due_idx      ON public.crm_tasks (due_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS crm_tasks_lead_idx     ON public.crm_tasks (lead_id);

-- ---------------------------------------------------------------------------
-- Helper triggers
-- ---------------------------------------------------------------------------

-- Touch updated_at on row update.
CREATE OR REPLACE FUNCTION public.crm_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_touch ON public.crm_leads;
CREATE TRIGGER crm_leads_touch BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

DROP TRIGGER IF EXISTS crm_tasks_touch ON public.crm_tasks;
CREATE TRIGGER crm_tasks_touch BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

DROP TRIGGER IF EXISTS feature_flags_touch ON public.feature_flags;
CREATE TRIGGER feature_flags_touch BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

-- Bump the parent lead's last_activity_at whenever a timeline entry is added.
-- SECURITY DEFINER so the cascade update is not blocked by RLS.
CREATE OR REPLACE FUNCTION public.crm_bump_lead_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.crm_leads
     SET last_activity_at = now()
   WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_lead_activities_bump ON public.crm_lead_activities;
CREATE TRIGGER crm_lead_activities_bump AFTER INSERT ON public.crm_lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.crm_bump_lead_activity();

-- Append-only audit (reuses the shared log_audit() trigger function).
DROP TRIGGER IF EXISTS audit_crm_leads ON public.crm_leads;
CREATE TRIGGER audit_crm_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_crm_tasks ON public.crm_tasks;
CREATE TRIGGER audit_crm_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_feature_flags ON public.feature_flags;
CREATE TRIGGER audit_feature_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Visibility model for this increment mirrors the existing staff console:
-- any staff/admin sees the full pipeline; admins alone may delete. Per-agent
-- "see only assigned" is deferred to Phase 3 when granular sales roles land.
-- The website lead-capture bridge writes via the service-role key (bypasses
-- RLS), so no anon policy is required here.
-- ---------------------------------------------------------------------------
ALTER TABLE public.events_outbox        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks            ENABLE ROW LEVEL SECURITY;

-- events_outbox: staff may enqueue; only admins read (system surface).
DROP POLICY IF EXISTS events_outbox_insert ON public.events_outbox;
CREATE POLICY events_outbox_insert ON public.events_outbox
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS events_outbox_select ON public.events_outbox;
CREATE POLICY events_outbox_select ON public.events_outbox
  FOR SELECT TO authenticated USING (public.is_admin());

-- feature_flags: staff read, admin manage.
DROP POLICY IF EXISTS feature_flags_select ON public.feature_flags;
CREATE POLICY feature_flags_select ON public.feature_flags
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS feature_flags_write ON public.feature_flags;
CREATE POLICY feature_flags_write ON public.feature_flags
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- crm_leads: staff full CRUD except delete; admin delete.
DROP POLICY IF EXISTS crm_leads_select ON public.crm_leads;
CREATE POLICY crm_leads_select ON public.crm_leads
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS crm_leads_insert ON public.crm_leads;
CREATE POLICY crm_leads_insert ON public.crm_leads
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS crm_leads_update ON public.crm_leads;
CREATE POLICY crm_leads_update ON public.crm_leads
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS crm_leads_delete ON public.crm_leads;
CREATE POLICY crm_leads_delete ON public.crm_leads
  FOR DELETE TO authenticated USING (public.is_admin());

-- crm_lead_activities: staff append + read (immutable — no update/delete policy).
DROP POLICY IF EXISTS crm_lead_activities_select ON public.crm_lead_activities;
CREATE POLICY crm_lead_activities_select ON public.crm_lead_activities
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS crm_lead_activities_insert ON public.crm_lead_activities;
CREATE POLICY crm_lead_activities_insert ON public.crm_lead_activities
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- crm_tasks: staff CRUD except delete; admin delete.
DROP POLICY IF EXISTS crm_tasks_select ON public.crm_tasks;
CREATE POLICY crm_tasks_select ON public.crm_tasks
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS crm_tasks_insert ON public.crm_tasks;
CREATE POLICY crm_tasks_insert ON public.crm_tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS crm_tasks_update ON public.crm_tasks;
CREATE POLICY crm_tasks_update ON public.crm_tasks
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS crm_tasks_delete ON public.crm_tasks;
CREATE POLICY crm_tasks_delete ON public.crm_tasks
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants (explicit ahead of the 2026-10-30 public-schema grant flip).
-- RLS still gates every row; grants only make the tables reachable.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads           TO authenticated;
GRANT SELECT, INSERT                 ON public.crm_lead_activities  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks           TO authenticated;
GRANT SELECT, INSERT                 ON public.events_outbox        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags       TO authenticated;

-- service_role keeps full access for the website lead bridge + background jobs.
GRANT ALL ON public.crm_leads, public.crm_lead_activities, public.crm_tasks,
             public.events_outbox, public.feature_flags TO service_role;

-- ---------------------------------------------------------------------------
-- Seed: register this module's feature flag (enabled).
-- ---------------------------------------------------------------------------
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('sales_crm', true, 'Sales CRM: leads, pipeline, lead 360')
ON CONFLICT (key) DO NOTHING;
