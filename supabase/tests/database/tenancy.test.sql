-- Tenant isolation (CLAUDE.md §4): tenant A can never read or write tenant B, and outlet
-- assignments limit what non-owners see. Each block logs in as a real authenticated user.
begin;
select plan(24);

-- Fixtures (as postgres, bypassing RLS) ------------------------------------------------------
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
  ('a1000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000000', 'A Two', 'ATWO'),
  ('b1000000-0000-0000-0000-0000000000b1', 'b1000000-0000-0000-0000-000000000000', 'B One', 'BONE');

insert into public.memberships (org_id, user_id, role, outlet_ids) values
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'owner', '{}'),
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a2', 'manager',
   '{a1000000-0000-0000-0000-0000000000a2}'),
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a1', 'cashier',
   '{a1000000-0000-0000-0000-0000000000a1}'),
  ('b1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'owner', '{}');

-- RLS is on everywhere ------------------------------------------------------------------------
select ok(relrowsecurity, format('RLS enabled on %s', relname))
from pg_class
where oid in ('public.orgs'::regclass, 'public.outlets'::regclass,
              'public.profiles'::regclass, 'public.memberships'::regclass)
order by relname;

-- Anonymous ----------------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.orgs', '42501', null, 'anon cannot read orgs');
select throws_ok('select * from public.outlets', '42501', null, 'anon cannot read outlets');
reset role;

-- Owner A ------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);

select results_eq('select name from public.orgs', $$values ('Org A')$$,
  'owner A sees only org A');
select is((select count(*) from public.outlets), 2::bigint,
  'owner A sees both A outlets and no B outlet');
select is((select count(*) from public.memberships), 3::bigint,
  'owner A sees all of A''s members and none of B''s');
select throws_ok(
  $$insert into public.outlets (org_id, name, code)
    values ('b1000000-0000-0000-0000-000000000000', 'Sneaky', 'SNKY')$$,
  '42501', null, 'owner A cannot add an outlet to org B');
select lives_ok(
  $$insert into public.outlets (org_id, name, code)
    values ('a1000000-0000-0000-0000-000000000000', 'A Three', 'ATHR')$$,
  'owner A can add an outlet to org A');
select throws_ok(
  $$delete from public.memberships where user_id = 'a0000000-0000-0000-0000-00000000000a'$$,
  'P0001', 'An org needs at least one active owner.', 'the only owner cannot remove themselves');
reset role;

-- Manager A (assigned to A Two) --------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a2"}', true);

select results_eq('select code from public.outlets', $$values ('ATWO')$$,
  'manager A sees only the outlet they are assigned to');
select is((select count(*) from public.profiles), 3::bigint,
  'manager A sees the profiles of A''s staff, not B''s');
select throws_ok(
  $$insert into public.memberships (org_id, user_id, role)
    values ('a1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'cashier')$$,
  '42501', null, 'manager A cannot add members (owners only)');
reset role;

-- Cashier A (assigned to A One) --------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1"}', true);

select results_eq('select code from public.outlets', $$values ('AONE')$$,
  'cashier A sees only their outlet');
select is((select count(*) from public.memberships), 1::bigint,
  'cashier A sees only their own membership');
select results_eq('select full_name from public.profiles', $$values ('Cashier A')$$,
  'cashier A sees only their own profile');
update public.orgs set name = 'Hacked' where id = 'a1000000-0000-0000-0000-000000000000';
update public.memberships set role = 'owner' where user_id = 'a0000000-0000-0000-0000-0000000000a1';
reset role;

select is((select name from public.orgs where id = 'a1000000-0000-0000-0000-000000000000'), 'Org A',
  'cashier A cannot rename the org');
select is(
  (select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-0000000000a1'),
  'cashier', 'cashier A cannot promote themselves');

-- Owner B ------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b"}', true);

select is(
  (select count(*) from public.outlets where org_id = 'a1000000-0000-0000-0000-000000000000'),
  0::bigint, 'owner B sees no A outlets');
select is((select count(*) from public.profiles), 1::bigint,
  'owner B sees no A staff profiles');
update public.outlets set name = 'Taken over' where org_id = 'a1000000-0000-0000-0000-000000000000';
reset role;

select is((select count(*) from public.outlets where name = 'Taken over'), 0::bigint,
  'owner B cannot edit A outlets');

-- Deleting a whole org is still possible (cascades past the owner guard) ----------------------
select lives_ok($$delete from public.orgs where id = 'b1000000-0000-0000-0000-000000000000'$$,
  'deleting an org cascades to its members');

select * from finish();
rollback;
