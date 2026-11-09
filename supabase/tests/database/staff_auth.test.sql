-- Devices and PINs: who can register devices, what a device's roster reveals, PIN rules, lockout.
begin;
select plan(25);

-- Fixtures ------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('a0000000-0000-0000-0000-0000000000a1', 'cashier-a1@test.local'),
  ('a0000000-0000-0000-0000-0000000000a2', 'cashier-a2@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@test.local');

insert into public.profiles (id, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Owner A'),
  ('a0000000-0000-0000-0000-0000000000a1', 'Cashier One'),
  ('a0000000-0000-0000-0000-0000000000a2', 'Cashier Two'),
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
  ('a2000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-0000000000a2', 'cashier', '{a1000000-0000-0000-0000-0000000000a2}'),
  ('b2000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-00000000000b', 'owner', '{}');

-- Somewhere to keep what register_device returns across role switches.
create temp table registered (n int, result jsonb);
grant all on registered to authenticated, anon, service_role;

-- Owner A registers devices ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);

insert into registered
select 1, public.register_device('a1000000-0000-0000-0000-0000000000a1', 'Counter tablet');
insert into registered
select 2, public.register_device('a1000000-0000-0000-0000-0000000000a1', 'Second tablet');

select is((select result ->> 'code' from registered where n = 1), 'T1', 'first device is T1');
select is((select result ->> 'code' from registered where n = 2), 'T2', 'second device is T2');
select is(length((select result ->> 'secret' from registered where n = 1)), 64,
  'the device gets a 256-bit secret, once');

select throws_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a1', '1111')$$,
  '22023', null, 'a PIN of one repeated digit is refused');
select throws_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a1', '3456')$$,
  '22023', null, 'a PIN in a straight run is refused');
select throws_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a1', '12ab')$$,
  '22023', null, 'a PIN with letters is refused');
select throws_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a1', '13579')$$,
  '22023', null, 'PINs are exactly 4 digits');
select lives_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a1', '1357')$$,
  'owner sets cashier one''s PIN');
select lives_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a2', '2468')$$,
  'owner sets cashier two''s PIN');
select throws_ok('select * from public.staff_pins', '42501', null,
  'even the owner cannot read PIN hashes directly');
reset role;

-- Others cannot register devices or set PINs ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1"}', true);
select throws_ok(
  $$select public.register_device('a1000000-0000-0000-0000-0000000000a1', 'Mine')$$,
  '42501', null, 'a cashier cannot register a device');
select throws_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a2', '8642')$$,
  '42501', null, 'a cashier cannot set a colleague''s PIN');
select lives_ok($$select public.set_staff_pin('a2000000-0000-0000-0000-0000000000a1', '1357')$$,
  'a cashier can set their own PIN');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b"}', true);
select throws_ok(
  $$select public.register_device('a1000000-0000-0000-0000-0000000000a1', 'Sneaky')$$,
  '42501', null, 'owner B cannot register a device at an A outlet');
select is((select count(*) from public.devices), 0::bigint, 'owner B sees none of A''s devices');
reset role;

-- The roster, as an anonymous device -----------------------------------------------------------
set local role anon;
select throws_ok(
  format($$select public.device_roster(%L, 'wrong')$$,
    (select result ->> 'deviceId' from registered where n = 1)),
  '28000', null, 'a wrong device secret gets nothing');
select is(
  (select jsonb_agg(s ->> 'name')
   from jsonb_array_elements(
     public.device_roster((select (result ->> 'deviceId')::uuid from registered where n = 1),
                          (select result ->> 'secret' from registered where n = 1)) -> 'staff') s),
  '["Cashier One"]'::jsonb,
  'the roster lists PIN staff at this outlet only: no owner, no other outlet');
select throws_ok(
  $$select public.verify_staff_pin(gen_random_uuid(), 'x', gen_random_uuid(), '1357')$$,
  '42501', null, 'anon cannot call verify_staff_pin');
reset role;

-- verify_staff_pin, as the edge function (service role) ----------------------------------------
set local role service_role;
create temp table dev as
  select (result ->> 'deviceId')::uuid as id, result ->> 'secret' as secret from registered where n = 1;
grant select on dev to authenticated, anon;

select is(
  (select public.verify_staff_pin(dev.id, dev.secret, 'a2000000-0000-0000-0000-0000000000a2', '2468')
   ->> 'reason' from dev),
  'not_here', 'cashier two cannot sign in on a device at another outlet');
select is(
  (select public.verify_staff_pin(dev.id, dev.secret, 'a2000000-0000-0000-0000-0000000000a1', '0000')
   ->> 'triesLeft' from dev),
  '4', 'a wrong PIN says how many tries are left');
select is(
  (select public.verify_staff_pin(dev.id, dev.secret, 'a2000000-0000-0000-0000-0000000000a1', '1357')
   ->> 'email' from dev),
  'cashier-a1@test.local', 'the right PIN returns who to sign in');

select is(
  (select r ->> 'reason' from (
     select public.verify_staff_pin(dev.id, dev.secret, 'a2000000-0000-0000-0000-0000000000a1', '0000') r
     from dev, generate_series(1, 5)
   ) attempts offset 4),
  'locked', 'five wrong PINs lock the person out');
select is(
  (select public.verify_staff_pin(dev.id, dev.secret, 'a2000000-0000-0000-0000-0000000000a1', '1357')
   ->> 'reason' from dev),
  'locked', 'even the right PIN is refused while locked');
reset role;

-- Revoking a device cuts it off ----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);
select public.revoke_device((select id from dev));
reset role;

set local role anon;
select throws_ok(
  format($$select public.device_roster(%L, %L)$$, (select id from dev), (select secret from dev)),
  '28000', null, 'a revoked device gets nothing');
reset role;
select is(
  (select public.verify_staff_pin(id, secret, 'a2000000-0000-0000-0000-0000000000a1', '1357')
   ->> 'reason' from dev),
  'device', 'a revoked device cannot sign anyone in');

select * from finish();
rollback;
