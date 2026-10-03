-- Request log for the live REST API gateway (/api/v1/*) + usage analytics.
create table if not exists public.tech_api_requests (
  id uuid primary key default gen_random_uuid(),
  key_id uuid, key_name text, path text, method text,
  status integer, latency_ms integer, ip text,
  created_at timestamptz not null default now()
);
create index if not exists tech_api_requests_created_idx on public.tech_api_requests (created_at desc);
create index if not exists tech_api_requests_key_idx on public.tech_api_requests (key_id, created_at desc);
alter table public.tech_api_requests enable row level security;
drop policy if exists tech_api_requests_sa on public.tech_api_requests;
create policy tech_api_requests_sa on public.tech_api_requests for select using (public.tech_is_super_admin());
-- inserts happen via the service role (gateway), which bypasses RLS.

create or replace function public.tech_api_usage()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.tech_is_super_admin() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.tech_api_requests),
    'last_24h', (select count(*) from public.tech_api_requests where created_at >= now() - interval '24 hours'),
    'last_1h', (select count(*) from public.tech_api_requests where created_at >= now() - interval '1 hour'),
    'errors_24h', (select count(*) from public.tech_api_requests where created_at >= now() - interval '24 hours' and status >= 400),
    'avg_latency_ms', (select coalesce(round(avg(latency_ms)),0) from public.tech_api_requests where created_at >= now() - interval '24 hours'),
    'by_endpoint', (select coalesce(jsonb_agg(x order by x.calls desc), '[]'::jsonb) from (
       select path, count(*) as calls, coalesce(round(avg(latency_ms)),0) as avg_ms
       from public.tech_api_requests where created_at >= now() - interval '7 days' group by path order by count(*) desc limit 12) x),
    'recent', (select coalesce(jsonb_agg(y), '[]'::jsonb) from (
       select key_name, path, method, status, latency_ms, ip, created_at
       from public.tech_api_requests order by created_at desc limit 20) y)
  );
end; $$;
revoke all on function public.tech_api_usage() from public, anon;
grant execute on function public.tech_api_usage() to authenticated;
