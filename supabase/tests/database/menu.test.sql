-- Menu: everyone at the business reads it; only the owner changes it; managers mark items sold
-- out at their own outlets; no row can point at another tenant's data.
begin;
select plan(16);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('a0000000-0000-0000-0000-0000000000a2', 'manager-a@test.local'),
  ('a0000000-0000-0000-0000-0000000000a1', 'cashier-a@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@test.local');
insert into public.profiles (id, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Owner A'),
  ('a0000000-0000-0000-0000-0000000000a2', 'Manager A'),
  ('a0000000-0000-0000-0000-0000000000a1', 'Cashier A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Owner B');
insert into public.orgs (id, name, slug) values
  ('a1000000-0000-0000-0000-000000000000', 'Org A', 'org-a'),
  ('b1000000-0000-0000-0000-000000000000', 'Org B', 'org-b');
insert into public.outlets (id, org_id, name, code) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000', 'A One', 'AONE'),
  ('a1000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000000', 'A Two', 'ATWO');
insert into public.memberships (org_id, user_id, role, outlet_ids) values
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'owner', '{}'),
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a2', 'manager',
   '{a1000000-0000-0000-0000-0000000000a2}'),
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a1', 'cashier',
   '{a1000000-0000-0000-0000-0000000000a1}'),
  ('b1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'owner', '{}');

insert into public.categories (id, org_id, name) values
  ('ac000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Cold Coffee'),
  ('bc000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'B Things');
insert into public.modifier_groups (id, org_id, name) values
  ('a9000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Milk'),
  ('b9000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'B Milk');

create temp table saved (n int, id uuid);
grant all on saved to authenticated;

-- Owner A builds the menu ------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);

insert into saved select 1, public.save_item(jsonb_build_object(
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'categoryId', 'ac000000-0000-0000-0000-000000000001',
  'name', 'Cold Coffee', 'code', 'cc', 'food', 'veg', 'pricePaise', 14900, 'taxRateBp', 500,
  'variants', jsonb_build_array(
    jsonb_build_object('name', 'Regular', 'pricePaise', 14900),
    jsonb_build_object('name', 'Large', 'pricePaise', 18900)),
  'modifierGroupIds', jsonb_build_array('a9000000-0000-0000-0000-000000000001')));

select is((select code from public.items where id = (select id from saved where n = 1)), 'CC',
  'codes are stored in capitals');
select is((select count(*) from public.item_variants where item_id = (select id from saved where n = 1)),
  2::bigint, 'sizes are saved with the item');
select is((select count(*) from public.item_modifier_groups where item_id = (select id from saved where n = 1)),
  1::bigint, 'add-on groups are linked');

-- Editing keeps a size whose name stays (and its outlet prices), drops the others.
select lives_ok($$select public.save_item(jsonb_build_object(
  'id', (select id from saved where n = 1),
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'categoryId', 'ac000000-0000-0000-0000-000000000001',
  'name', 'Cold Coffee', 'code', 'CC', 'food', 'veg', 'pricePaise', 15900, 'taxRateBp', 500,
  'variants', jsonb_build_array(jsonb_build_object('name', 'Large', 'pricePaise', 19900)),
  'modifierGroupIds', '[]'::jsonb))$$, 'the owner edits the item');
select is((select string_agg(name || ':' || price_paise, ',') from public.item_variants
  where item_id = (select id from saved where n = 1)), 'Large:19900', 'sizes follow the edit');

select throws_ok($$select public.save_item(jsonb_build_object(
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'categoryId', 'bc000000-0000-0000-0000-000000000001',
  'name', 'Sneaky', 'code', 'SNK', 'food', 'veg', 'pricePaise', 100, 'taxRateBp', 500))$$,
  '23503', null, 'an item cannot sit in another tenant''s category');
select throws_ok($$select public.save_item(jsonb_build_object(
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'categoryId', 'ac000000-0000-0000-0000-000000000001',
  'name', 'Sneaky', 'code', 'SNK', 'food', 'veg', 'pricePaise', 100, 'taxRateBp', 500,
  'modifierGroupIds', jsonb_build_array('b9000000-0000-0000-0000-000000000001')))$$,
  '23503', null, 'an item cannot use another tenant''s add-ons');
select throws_ok($$select public.save_item(jsonb_build_object(
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'categoryId', 'ac000000-0000-0000-0000-000000000001',
  'name', 'Odd GST', 'code', 'ODD', 'food', 'veg', 'pricePaise', 100, 'taxRateBp', 700))$$,
  '23514', null, 'only real GST slabs (0, 5, 12, 18, 28%)');
reset role;

-- Manager A (assigned to A Two) ----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a2"}', true);
select throws_ok($$select public.save_item(jsonb_build_object(
  'id', (select id from saved where n = 1),
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'categoryId', 'ac000000-0000-0000-0000-000000000001',
  'name', 'Cold Coffee', 'code', 'CC', 'food', 'veg', 'pricePaise', 1, 'taxRateBp', 500))$$,
  '42501', null, 'a manager cannot change menu prices');
select lives_ok($$insert into public.item_outlet_overrides (org_id, outlet_id, item_id, is_available)
  values ('a1000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-0000000000a2',
          (select id from saved where n = 1), false)$$,
  'a manager marks an item sold out at their own outlet');
select throws_ok($$insert into public.item_outlet_overrides (org_id, outlet_id, item_id, is_available)
  values ('a1000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-0000000000a1',
          (select id from saved where n = 1), false)$$,
  '42501', null, 'but not at an outlet they don''t manage');
reset role;

-- Cashier A ------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1"}', true);
select is((select count(*) from public.items), 1::bigint, 'a cashier reads the menu to bill from it');
select throws_ok($$insert into public.categories (org_id, name)
  values ('a1000000-0000-0000-0000-000000000000', 'Mine')$$,
  '42501', null, 'a cashier cannot add categories');
select throws_ok($$insert into public.item_outlet_overrides (org_id, outlet_id, item_id, is_available)
  values ('a1000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-0000000000a1',
          (select id from saved where n = 1), false)$$,
  '42501', null, 'a cashier cannot mark items sold out');
reset role;

-- Owner B ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b"}', true);
select is((select count(*) from public.items), 0::bigint, 'owner B sees none of A''s menu');
select throws_ok($$select public.save_item(jsonb_build_object(
  'id', (select id from saved where n = 1),
  'orgId', 'b1000000-0000-0000-0000-000000000000', 'categoryId', 'bc000000-0000-0000-0000-000000000001',
  'name', 'Taken', 'code', 'TKN', 'food', 'veg', 'pricePaise', 1, 'taxRateBp', 500))$$,
  'P0002', null, 'owner B cannot take over A''s item by id');
reset role;

select * from finish();
rollback;
