-- ============================================================================
-- 20260529170001_outbox_ib_settled_handler.sql
-- Extend the event-bus consumer with an ib.commission_settled handler so IBs
-- get a notification when their accrued commission is paid into their wallet.
--
-- ADDITIVE: CREATE OR REPLACE of dispatch_outbox_events — same signature,
-- behaviour, and grants as 20260529160000; only adds one ELSIF branch.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.dispatch_outbox_events(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_evt    record;
  v_user   uuid;
  v_admin  record;
  v_ib     record;
  v_amount numeric;
  v_count  integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'dispatch_outbox_events: staff access only';
  END IF;

  FOR v_evt IN
    SELECT * FROM public.events_outbox
     WHERE processed_at IS NULL
     ORDER BY created_at ASC
     LIMIT GREATEST(p_limit, 1)
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      IF v_evt.topic = 'fee.charged' THEN
        v_user   := NULLIF(v_evt.payload->>'user_id','')::uuid;
        v_amount := COALESCE((v_evt.payload->>'amount')::numeric, 0);
        IF v_user IS NOT NULL AND v_amount <> 0 THEN
          INSERT INTO public.notifications (user_id, kind, title, body, link)
          VALUES (
            v_user, 'funds',
            CASE WHEN v_amount < 0 THEN 'Rebate credited' ELSE 'Fee applied' END,
            initcap(replace(COALESCE(v_evt.payload->>'fee_type','fee'), '_', ' '))
              || (CASE WHEN v_amount < 0 THEN ' rebate of ' ELSE ' fee of ' END)
              || trim(to_char(abs(v_amount), 'FM999999990.########'))
              || ' ' || COALESCE(v_evt.payload->>'currency','USD'),
            '/funds/history'
          );
        END IF;

      ELSIF v_evt.topic = 'trade.closed' THEN
        v_user := NULLIF(v_evt.payload->>'user_id','')::uuid;
        IF v_user IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, kind, title, body, link)
          VALUES (
            v_user, 'trade', 'Trade closed',
            COALESCE(v_evt.payload->>'symbol','—')
              || ' · ' || COALESCE(v_evt.payload->>'lots','0') || ' lots'
              || ' · P&L ' || COALESCE(v_evt.payload->>'pnl','0'),
            '/history'
          );
        END IF;

      ELSIF v_evt.topic = 'rebate.distributed' THEN
        FOR v_ib IN
          SELECT ib_user_id, currency, SUM(amount) AS amt
            FROM public.commission_ledger
           WHERE source_user_id = NULLIF(v_evt.payload->>'source_user_id','')::uuid
             AND metadata->>'source' = 'rebate_engine'
             AND (metadata->>'event_notified') IS DISTINCT FROM 'true'
           GROUP BY ib_user_id, currency
        LOOP
          INSERT INTO public.notifications (user_id, kind, title, body, link)
          VALUES (
            v_ib.ib_user_id, 'ib', 'IB rebate earned',
            'You earned ' || trim(to_char(v_ib.amt, 'FM999999990.00'))
              || ' ' || v_ib.currency || ' in trading rebates.',
            '/ib/report'
          );
        END LOOP;

        UPDATE public.commission_ledger
           SET metadata = metadata || jsonb_build_object('event_notified', 'true')
         WHERE source_user_id = NULLIF(v_evt.payload->>'source_user_id','')::uuid
           AND metadata->>'source' = 'rebate_engine'
           AND (metadata->>'event_notified') IS DISTINCT FROM 'true';

      ELSIF v_evt.topic = 'ib.commission_settled' THEN
        v_user   := NULLIF(v_evt.payload->>'user_id','')::uuid;
        v_amount := COALESCE((v_evt.payload->>'amount')::numeric, 0);
        IF v_user IS NOT NULL AND v_amount > 0 THEN
          INSERT INTO public.notifications (user_id, kind, title, body, link)
          VALUES (
            v_user, 'ib', 'Commission paid out',
            'Your accrued IB commission of '
              || trim(to_char(v_amount, 'FM999999990.00'))
              || ' ' || COALESCE(v_evt.payload->>'currency','USD')
              || ' has been settled to your wallet.',
            '/ib/report'
          );
        END IF;

      ELSIF v_evt.topic LIKE '%failed' THEN
        FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'admin'
        LOOP
          INSERT INTO public.notifications (user_id, kind, title, body, link)
          VALUES (
            v_admin.id, 'system',
            'Money-flow alert: ' || v_evt.topic,
            left(COALESCE(v_evt.payload->>'error', 'See event payload for details.'), 280),
            '/staff/events'
          );
        END LOOP;
      END IF;

      UPDATE public.events_outbox
         SET processed_at = now(), attempts = attempts + 1
       WHERE id = v_evt.id;
      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.events_outbox SET attempts = attempts + 1 WHERE id = v_evt.id;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_outbox_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_outbox_events(integer) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- END 20260529170001_outbox_ib_settled_handler.sql
-- ============================================================================
