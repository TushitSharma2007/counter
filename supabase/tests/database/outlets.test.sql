-- Outlet details the owner edits: the UPI ID check must actually run (it once couldn't).
begin;
select plan(3);

insert into public.orgs (id, name, slug) values ('a1000000-0000-0000-0000-000000000000', 'Org A', 'org-a');
insert into public.outlets (id, org_id, name, code)
values ('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000', 'A One', 'AONE');

select lives_ok($$update public.outlets set upi_vpa = 'demo-coffee@okaxis' where code = 'AONE'$$,
  'a real-looking UPI ID saves');
select throws_ok($$update public.outlets set upi_vpa = 'not a upi id' where code = 'AONE'$$,
  '23514', null, 'junk is refused');
select lives_ok($$update public.outlets set upi_vpa = null where code = 'AONE'$$, 'it can be cleared');

select * from finish();
rollback;
