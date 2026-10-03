-- Add the Spread & Markup module, seed spread profiles + global pricing settings,
-- and flip the remaining modules to 'available' now that they're wired.
insert into public.tech_modules (key, category, name, description, features, status, enabled, icon, sort) values
('spreads','Trading','Spread & Markup Management','Institutional pricing: spreads, markups, commissions, profiles, LP routing.',
 '["Global & per-symbol spreads","Buy/sell & fixed/dynamic markup","Per-symbol commission (live)","Spread profiles (retail/pro/vip/institutional/IB)","Per-LP markup (live)","Aggregation / best bid-ask","Change history & audit","Rollback-ready"]','available',true,'Gauge',65)
on conflict (key) do update set status='available', name=excluded.name, description=excluded.description, features=excluded.features, sort=excluded.sort, updated_at=now();

update public.tech_modules set status='available', updated_at=now()
where key in ('signals','marketplace','devtools','broker_ops','infra','automation');

insert into public.tech_settings (key, value, category) values
 ('pricing_global_markup_bps','0'::jsonb,'pricing'),
 ('pricing_weekend_multiplier','1.5'::jsonb,'pricing'),
 ('pricing_holiday_multiplier','2.0'::jsonb,'pricing'),
 ('pricing_news_widening_bps','0'::jsonb,'pricing')
on conflict (key) do nothing;

insert into public.tech_registry (kind, name, label, status, config) values
 ('spread_profile','Retail','Standard retail clients','active','{"markup_bps":1.0,"commission_per_lot":3.5,"segment":"retail"}'),
 ('spread_profile','Professional','Pro / high-volume','active','{"markup_bps":0.6,"commission_per_lot":2.5,"segment":"professional"}'),
 ('spread_profile','VIP','VIP clients','active','{"markup_bps":0.3,"commission_per_lot":1.5,"segment":"vip"}'),
 ('spread_profile','Institutional','Institutional / raw','active','{"markup_bps":0.1,"commission_per_lot":1.0,"segment":"institutional"}'),
 ('spread_profile','Introducing Broker','IB-routed accounts','active','{"markup_bps":1.2,"commission_per_lot":4.0,"segment":"ib"}')
on conflict do nothing;

-- NOTE: the terminal-side change (instruments.commission_per_lot + place_market_order
-- reading it via COALESCE) lives in the Gioraptor/terminal project
-- (leumpgkfillgeyyfptef), migration `instruments_commission_per_lot`.
