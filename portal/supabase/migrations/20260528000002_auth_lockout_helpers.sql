-- ============================================================================
-- 20260528000002_auth_lockout_helpers.sql
-- ============================================================================
-- Purpose: Server-side helpers for the Phase B authentication suite.
--   - check_login_lockout(email, max_attempts, window_minutes) → boolean
--   - record_login_attempt(...) → void
--
-- Both functions are SECURITY DEFINER (anon can call them — login happens
-- BEFORE auth) and write through to public.login_history (RLS-deny for
-- anonymous, but the function owner can insert).
--
-- Defaults match .env.example: AUTH_MAX_FAILED_ATTEMPTS=5, AUTH_LOCKOUT_MINUTES=15.
--
-- Rollback:
--   DROP FUNCTION public.check_login_lockout(text, integer, integer);
--   DROP FUNCTION public.record_login_attempt(text, boolean, text, uuid, text, text, text, text);
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- check_login_lockout — returns true if the email has hit the failure
-- threshold within the configured window.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_login_lockout(
  p_email           text,
  p_max_attempts    integer DEFAULT 5,
  p_window_minutes  integer DEFAULT 15
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*) >= p_max_attempts
    FROM public.login_history
   WHERE success = false
     AND email_attempted = p_email::citext
     AND created_at > (now() - make_interval(mins => p_window_minutes));
$$;

REVOKE ALL ON FUNCTION public.check_login_lockout(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(text, integer, integer)
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- record_login_attempt — appends to login_history. Anonymous callers can use
-- it (failed attempts on unknown emails happen pre-auth).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email           text,
  p_success         boolean,
  p_failure_reason  text DEFAULT NULL,
  p_user_id         uuid DEFAULT NULL,
  p_ip              text DEFAULT NULL,
  p_user_agent      text DEFAULT NULL,
  p_device_id       text DEFAULT NULL,
  p_country         text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ip inet;
BEGIN
  BEGIN
    v_ip := NULLIF(p_ip, '')::inet;
  EXCEPTION WHEN others THEN
    v_ip := NULL;
  END;

  INSERT INTO public.login_history
    (user_id, email_attempted, success, failure_reason, ip_address, user_agent, device_id, country)
  VALUES
    (p_user_id, p_email::citext, p_success, p_failure_reason, v_ip, p_user_agent, p_device_id, p_country);
END;
$$;

REVOKE ALL ON FUNCTION public.record_login_attempt(text, boolean, text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text, uuid, text, text, text, text)
  TO anon, authenticated, service_role;

COMMIT;
