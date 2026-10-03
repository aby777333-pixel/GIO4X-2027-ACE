-- Schedule the raptor-trade-bridge edge function every minute. The bridge
-- secret is read from public.bridge_secrets at call time (never stored in the
-- job text). pg_cron runs as postgres → bypasses RLS to read it.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'raptor-trade-bridge',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://tdifcayznqnaduchzfqz.supabase.co/functions/v1/raptor-trade-bridge',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-bridge-secret', (select value from public.bridge_secrets where key = 'bridge_secret')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
