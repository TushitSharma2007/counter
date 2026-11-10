-- Staff management and tablet pairing.
begin;
select plan(22);

insert into auth.users (id, email, raw_app_meta_data, created_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@test.local', '{}', now()),
  ('a0000000-0000-0000-0000-0000000000a9', 'manager-a@test.local', '{}', now()),
  ('a0000000-0000-0000-0000-0000000000a1', 'cashier-a1@test.local', '{}', now()),
  ('a0000000-0000-0000-0000-0000000000a2', 'cashier-a2@test.local', '{}', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@test.local', '{}', now()),
  -- logins as staff-create would make them
  ('a0000000-0000-0000-0000-0000000000f1', 'f1@staff.invalid', '{"created_by":"a0000000-0000-0000-0000-00000000000a"}', now()),
  ('a0000000-0000-0000-0000-0000000000f2', 'f2@staff.invalid', '{"created_by":"b0000000-0000-0000-0000-00000000000b"}', now()),
  ('a0000000-0000-0000-0000-0000000000f3', 'f3@staff.invalid', '{"created_by":"a0000000-0000-0000-0000-00000000000a"}', now() - interval '1 hour');
insert into public.profiles (id, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Owner A'),
  ('a0000000-0000-0000-0000-0000000000a9', 'Manager A'),
  ('a0000000-0000-0000-0000-0000000000a1', 'Cashier One'),
  ('a0000000-0000-0000-0000-0000000000a2', 'Cashier Two'),
  ('b0000000-0000-0000-0000-00000000000b', 'Owner B');
insert into public.orgs (id, name, slug) values
  ('a1000000-0000-0000-0000-000000000000', 'Org A', 'org-a'),
  ('b1000000-0000-0000-0000-000000000000', 'Org B', 'org-b');
insert into public.outlets (id, org_id, name, code) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000', 'A One', 'AONE'),
  ('a1000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000000', 'A Two', 'ATWO'),
  ('b1000000-0000-0000-0000-0000000000b1', 'b1000000-0000-0000-0000-000000000000', 'B One', 'BONE');
insert into public.memberships (id, org_id, user_id, role, outlet_ids) values
  ('a2000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'owner', '{}'),
  ('a2000000-0000-0000-0000-0000000000a9', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a9', 'manager', '{a1000000-0000-0000-0000-0000000000a2}'),
  ('a2000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a1', 'cashier', '{a1000000-0000-0000-0000-0000000000a1}'),
  ('a2000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a2', 'cashier', '{a1000000-0000-0000-0000-0000000000a2}'),
  ('b2000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'owner', '{}');

create temp table got (n int, result jsonb);
grant all on got to authenticated, anon;

-- Manager A (at A Two) ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a9"}', true);
select lives_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a2', '2468')$$,
  'a manager resets the PIN of a cashier at their outlet');
select throws_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a1', '2468')$$,
  '42501', null, 'but not of a cashier at another outlet');
select throws_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-00000000000a', '2468')$$,
  '42501', null, 'and not the owner''s');
select is(
  (select jsonb_agg(s ->> 'name') from jsonb_array_elements(public.list_staff('a1000000-0000-0000-0000-000000000000')) s),
  '["Cashier Two"]'::jsonb, 'a manager sees only the staff they can manage');
select throws_ok($$select public.add_staff(jsonb_build_object('userId', 'a0000000-0000-0000-0000-0000000000f1',
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'name', 'X', 'role', 'cashier',
  'outletIds', jsonb_build_array('a1000000-0000-0000-0000-0000000000a2')))$$,
  '42501', null, 'a manager cannot add staff');
insert into got select 10, public.create_pairing_code('a1000000-0000-0000-0000-0000000000a2', 'Counter tablet');
select throws_ok($$select public.create_pairing_code('a1000000-0000-0000-0000-0000000000a1', 'Counter tablet')$$,
  '42501', null, 'a manager can''t pair tablets at an outlet they don''t manage');
reset role;

-- Owner A ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);

insert into got select 1, to_jsonb(public.add_staff(jsonb_build_object(
  'userId', 'a0000000-0000-0000-0000-0000000000f1', 'orgId', 'a1000000-0000-0000-0000-000000000000',
  'name', ' Kavya Joshi ', 'phone', '+91 98260-12345', 'role', 'cashier',
  'outletIds', jsonb_build_array('a1000000-0000-0000-0000-0000000000a1'), 'pin', '3691')));
select is((select full_name || '|' || phone from public.profiles where id = 'a0000000-0000-0000-0000-0000000000f1'),
  'Kavya Joshi|919826012345', 'the new staff member''s profile is saved, tidied');
select is(
  (select s ->> 'hasPin' from jsonb_array_elements(public.list_staff('a1000000-0000-0000-0000-000000000000')) s
   where s ->> 'name' = 'Kavya Joshi'),
  'true', 'their PIN is set (the list says so without showing it)');
select throws_ok($$select public.add_staff(jsonb_build_object('userId', 'a0000000-0000-0000-0000-0000000000f2',
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'name', 'X', 'role', 'cashier',
  'outletIds', jsonb_build_array('a1000000-0000-0000-0000-0000000000a1')))$$,
  '42501', null, 'an owner can''t claim a login someone else created');
select throws_ok($$select public.add_staff(jsonb_build_object('userId', 'a0000000-0000-0000-0000-0000000000f3',
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'name', 'X', 'role', 'cashier',
  'outletIds', jsonb_build_array('a1000000-0000-0000-0000-0000000000a1')))$$,
  '42501', null, 'or an old login');
select throws_ok($$select public.add_staff(jsonb_build_object('userId', 'a0000000-0000-0000-0000-0000000000a1',
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'name', 'X', 'role', 'cashier',
  'outletIds', jsonb_build_array('b1000000-0000-0000-0000-0000000000b1')))$$,
  '22023', null, 'staff can only work at the owner''s own outlets');
select throws_ok($$select public.add_staff(jsonb_build_object('userId', 'a0000000-0000-0000-0000-0000000000f1',
  'orgId', 'a1000000-0000-0000-0000-000000000000', 'name', 'X', 'role', 'owner',
  'outletIds', jsonb_build_array('a1000000-0000-0000-0000-0000000000a1')))$$,
  '22023', null, 'staff can''t be added as owners');

select lives_ok($$select public.update_staff(jsonb_build_object('membershipId', 'a2000000-0000-0000-0000-0000000000a1',
  'role', 'manager', 'outletIds', jsonb_build_array('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a2')))$$,
  'the owner promotes a cashier and gives them both outlets');
select is((select role::text || ':' || cardinality(outlet_ids) from public.memberships where id = 'a2000000-0000-0000-0000-0000000000a1'),
  'manager:2', 'the change is saved');
select lives_ok($$select public.update_staff(jsonb_build_object('membershipId', 'a2000000-0000-0000-0000-0000000000a2', 'isActive', false))$$,
  'the owner switches someone off');
select throws_ok($$select public.update_staff(jsonb_build_object('membershipId', 'a2000000-0000-0000-0000-00000000000a', 'role', 'cashier'))$$,
  '22023', null, 'the owner''s own role can''t be changed here');
reset role;

-- Owner B ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b"}', true);
select is(public.list_staff('a1000000-0000-0000-0000-000000000000'), '[]'::jsonb, 'owner B sees none of A''s staff');
select throws_ok($$select public.update_staff(jsonb_build_object('membershipId', 'a2000000-0000-0000-0000-0000000000a1', 'isActive', false))$$,
  '42501', null, 'owner B can''t switch off A''s staff');
reset role;

-- The tablet types the code in, before anyone is signed in -------------------------------------
set local role anon;
select is(length((select result ->> 'code' from got where n = 10)), 8, 'pairing codes are 8 characters');
insert into got select 11, public.pair_device(lower((select result ->> 'code' from got where n = 10)));
select is(length((select result ->> 'secret' from got where n = 11)), 64,
  'the code becomes a counter tablet at that outlet (typed in any case)');
select throws_ok(format($$select public.pair_device(%L)$$, (select result ->> 'code' from got where n = 10)),
  '28000', null, 'a code works once');
select throws_ok($$select public.pair_device('ABCD-EFGH')$$, '28000', null, 'a made-up code does nothing');
reset role;

select * from finish();
rollback;
