-- Register the Dealer Desk as a Tech Hub module (moved out of the staff console).
insert into public.tech_modules (key, category, name, description, features, status, enabled, icon, sort) values
('dealer','Trading','Dealer Desk','A/B-book routing, exposure, risk, hedging & liquidity — the trading control center.',
 '["A-Book / B-Book / Hybrid routing","Scope-based book config","Live routing preview","Exposure aggregation","Liquidity provider management","Risk scoring & toxic detection","Auto book switching","Hedging & emergency flatten","Trade surveillance","Revenue attribution","Intervention queue","Dealer audit trail"]'::jsonb,
 'available', true, 'Scale', 75)
on conflict (key) do update set category=excluded.category, name=excluded.name, description=excluded.description,
  features=excluded.features, status=excluded.status, icon=excluded.icon, sort=excluded.sort, updated_at=now();

insert into public.tech_capabilities (module_key, capability)
select 'dealer', feature from jsonb_array_elements_text((select features from public.tech_modules where key='dealer')) as feature
on conflict (module_key, capability) do nothing;
