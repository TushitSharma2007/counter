-- Personal devices: an owner's phone bills at any of their outlets, with its own code at each,
-- but can never be used to sign staff in with a PIN.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('a0000000-0000-0000-0000-0000000000a1', 'cashier-a1@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@test.local');
insert into public.profiles (id, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Owner A'),
  ('a0000000-0000-0000-0000-0000000000a1', 'Cashier One'),
  ('b0000000-0000-0000-0000-00000000000b', 'Owner B');
insert into public.orgs (id, name, slug) values
  ('a1000000-0000-0000-0000-000000000000', 'Org A', 'org-a'),
  ('b1000000-0000-0000-0000-000000000000', 'Org B', 'org-b');
insert into public.outlets (id, org_id, name, code) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000', 'A One', 'AONE'),
  ('a1000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000000', 'A Two', 'ATWO');
insert into public.memberships (id, org_id, user_id, role, outlet_ids) values
  ('a2000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-00000000000a', 'owner', '{}'),
  ('a2000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-0000000000a1', 'cashier', '{a1000000-0000-0000-0000-0000000000a1}'),
  ('b2000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-00000000000b', 'owner', '{}');
insert into public.staff_pins (membership_id, pin_hash)
values ('a2000000-0000-0000-0000-0000000000a1', extensions.crypt('1357', extensions.gen_salt('bf', 4)));

create temp table got (n int, result jsonb);
grant all on got to authenticated, service_role;

-- Owner A ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);

-- A shared counter tablet first takes T1 at A One.
insert into got select 0, public.register_device('a1000000-0000-0000-0000-0000000000a1', 'Counter tablet');
insert into got select 1, public.ensure_personal_device('a1000000-0000-0000-0000-0000000000a1', 'Owner A''s phone');
insert into got select 2, public.ensure_personal_device('a1000000-0000-0000-0000-0000000000a1', 'Owner A''s phone');
insert into got select 3, public.ensure_personal_device('a1000000-0000-0000-0000-0000000000a2', 'Owner A''s phone');

select is((select result ->> 'code' from got where n = 1), 'T2',
  'the owner''s phone gets the next code after the counter tablet');
select is((select result ->> 'deviceId' from got where n = 2), (select result ->> 'deviceId' from got where n = 1),
  'asking again at the same outlet returns the same device');
select isnt((select result ->> 'deviceId' from got where n = 3), (select result ->> 'deviceId' from got where n = 1),
  'another outlet gets its own device, so its own bill series');
select is((select result ->> 'code' from got where n = 3), 'T1', 'codes are per outlet');
select is((select count(*) from public.devices where kind = 'personal'), 2::bigint,
  'the owner sees their two personal devices');
reset role;

-- Others ----------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1"}', true);
select throws_ok(
  $$select public.ensure_personal_device('a1000000-0000-0000-0000-0000000000a1', 'Mine')$$,
  '42501', null, 'a cashier cannot turn their phone into a counter');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b"}', true);
select throws_ok(
  $$select public.ensure_personal_device('a1000000-0000-0000-0000-0000000000a1', 'Sneaky')$$,
  '42501', null, 'owner B cannot bill at an A outlet');
select is((select count(*) from public.devices), 0::bigint, 'owner B sees none of A''s devices');
reset role;

-- A personal device can never sign staff in with a PIN -----------------------------------------
set local role service_role;
select is(
  public.verify_staff_pin(
    (select (result ->> 'deviceId')::uuid from got where n = 1), '',
    'a2000000-0000-0000-0000-0000000000a1', '1357'
  ) ->> 'reason',
  'device', 'PIN sign-in is refused on a personal device');
reset role;

select * from finish();
rollback;
