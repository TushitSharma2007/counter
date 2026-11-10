-- Bills: only real devices send them, sending twice is harmless, the server checks the sums and
-- numbering, staff read bills only at their outlets, and voids need a manager.
begin;
select plan(24);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('a0000000-0000-0000-0000-0000000000a9', 'manager-a2@test.local'),
  ('a0000000-0000-0000-0000-0000000000a8', 'manager-a1@test.local'),
  ('a0000000-0000-0000-0000-0000000000a1', 'cashier-a1@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@test.local');
insert into public.profiles (id, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Owner A'),
  ('a0000000-0000-0000-0000-0000000000a9', 'Manager A2'),
  ('a0000000-0000-0000-0000-0000000000a8', 'Manager A1'),
  ('a0000000-0000-0000-0000-0000000000a1', 'Cashier A1'),
  ('b0000000-0000-0000-0000-00000000000b', 'Owner B');
insert into public.orgs (id, name, slug) values
  ('a1000000-0000-0000-0000-000000000000', 'Org A', 'org-a'),
  ('b1000000-0000-0000-0000-000000000000', 'Org B', 'org-b');
insert into public.outlets (id, org_id, name, code) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000', 'A One', 'AONE'),
  ('a1000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000000', 'A Two', 'ATWO');
insert into public.memberships (id, org_id, user_id, role, outlet_ids) values
  ('a2000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'owner', '{}'),
  ('a2000000-0000-0000-0000-0000000000a9', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a9', 'manager', '{a1000000-0000-0000-0000-0000000000a2}'),
  ('a2000000-0000-0000-0000-0000000000a8', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a8', 'manager', '{a1000000-0000-0000-0000-0000000000a1}'),
  ('a2000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-0000000000a1', 'cashier', '{a1000000-0000-0000-0000-0000000000a1}'),
  ('b2000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'owner', '{}');
insert into public.devices (id, org_id, outlet_id, code, label, kind, secret_hash, user_id, revoked_at) values
  ('d0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-0000000000a1',
   'T1', 'Counter', 'counter', encode(extensions.digest('secret-one', 'sha256'), 'hex'), null, null),
  ('d0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-0000000000a1',
   'T2', 'Owner A''s phone', 'personal', null, 'a0000000-0000-0000-0000-00000000000a', null),
  ('d0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-0000000000a1',
   'T3', 'Stolen', 'counter', encode(extensions.digest('secret-three', 'sha256'), 'hex'), null, now());

-- A bill as @repo/pos-core builds it: one Cold Coffee at ₹149, paid in cash.
create function pg_temp.bill(p_id text, p_device text, p_code text, p_seq int,
                             p_total bigint default 14900, p_paid bigint default 14900, p_outlet text default 'a1000000-0000-0000-0000-0000000000a1')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'deviceId', p_device, 'outletId', p_outlet, 'financialYear', '2627', 'billSeq', p_seq,
    'billNumber', 'AONE-' || p_code || '/2627/' || lpad(p_seq::text, 6, '0'),
    'businessDate', '2026-11-10', 'createdAt', '2026-11-10T06:00:00Z', 'orderType', 'counter',
    'customerPhone', null,
    'billedBy', jsonb_build_object('membershipId', 'a2000000-0000-0000-0000-0000000000a1', 'name', 'Cashier A1'),
    'tax', jsonb_build_object('gstScheme', 'regular', 'pricesIncludeTax', true, 'rounding', 'bill'),
    'totals', jsonb_build_object('itemTotalPaise', p_total, 'taxablePaise', 14190, 'cgstPaise', 355,
                                 'sgstPaise', 355, 'roundOffPaise', 0, 'totalPaise', p_total),
    'lines', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'itemId', null, 'name', 'Cold Coffee', 'variantName', null, 'modifiers', '[]'::jsonb,
      'unitPaise', 14900, 'qty', 1, 'taxRateBp', 500, 'lineTotalPaise', 14900)),
    'payments', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'mode', 'cash', 'amountPaise', p_paid, 'tenderedPaise', null))
  );
$$;
grant execute on function pg_temp.bill to anon, authenticated;

-- A counter tablet, before anyone signs in (offline PIN sign-ins sync this way) ---------------
set local role anon;
select is(public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'T1', 1), 'secret-one') ->> 'status',
  'saved', 'a counter tablet sends a bill with its own key');
select is(public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'T1', 1), 'secret-one') ->> 'status',
  'already_saved', 'sending the same bill again is harmless');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'T1', 2), 'wrong')$$,
  '28000', null, 'a wrong device key is refused');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'T3', 1), 'secret-three')$$,
  '28000', null, 'a revoked tablet can''t send bills');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'T9', 2), 'secret-one')$$,
  '22023', null, 'the bill number must match the device''s series');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'T1', 2, 99999, 99999), 'secret-one')$$,
  '22023', null, 'bill lines must add up');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000006', 'd0000000-0000-0000-0000-000000000001', 'T1', 2, 14900, 10000), 'secret-one')$$,
  '22023', null, 'payments must add up to the bill');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000007', 'd0000000-0000-0000-0000-000000000001', 'T1', 1), 'secret-one')$$,
  '23505', null, 'a bill number can''t be used twice');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000008', 'd0000000-0000-0000-0000-000000000001', 'T1', 2, 14900, 14900, 'a1000000-0000-0000-0000-0000000000a2'), 'secret-one')$$,
  '22023', null, 'a tablet can''t bill for another outlet');
select is(public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000009', 'd0000000-0000-0000-0000-000000000001', 'T1', 2), 'secret-one') ->> 'status',
  'saved', 'the next number in the series is fine');
select is(public.device_last_bill_seq('d0000000-0000-0000-0000-000000000001', '2627', 'secret-one'), 2,
  'a tablet whose storage was wiped can ask where its series got to');
select throws_ok('select * from public.orders', '42501', null, 'anon can''t read bills');
reset role;

-- Owner A, on their phone ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);
select is(public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000010', 'd0000000-0000-0000-0000-000000000002', 'T2', 1)) ->> 'status',
  'saved', 'the owner''s phone sends bills with the owner''s login');
select is((select count(*) from public.orders), 3::bigint, 'the owner reads every bill');
select throws_ok($$insert into public.orders (id, org_id, outlet_id, device_id, financial_year, bill_seq, bill_number,
  business_date, order_type, billed_by_name, gst_scheme, prices_include_tax, tax_rounding, item_total_paise,
  taxable_paise, cgst_paise, sgst_paise, round_off_paise, total_paise, created_at)
  values (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-0000000000a1',
  'd0000000-0000-0000-0000-000000000001', '2627', 99, 'x', current_date, 'counter', 'x', 'regular', true, 'bill',
  0, 0, 0, 0, 0, 0, now())$$, '42501', null, 'no one writes bills directly, only through upsert_order');
reset role;

-- Cashier A1: reads bills at their outlet; Owner B: none --------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1"}', true);
select is((select count(*) from public.order_items), 3::bigint, 'a cashier reads bill lines at their outlet');
select throws_ok($$select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000011', 'd0000000-0000-0000-0000-000000000002', 'T2', 2))$$,
  '28000', null, 'nobody else can send bills as the owner''s phone');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b"}', true);
select is((select count(*) from public.orders), 0::bigint, 'owner B sees none of A''s bills');
reset role;

-- Voids ----------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select public.void_order(jsonb_build_object('orderId', '01900000-0000-7000-8000-000000000001',
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'reason', 'Customer cancelled',
  'approvedBy', 'a2000000-0000-0000-0000-0000000000a1'), 'secret-one')$$,
  '42501', null, 'a cashier can''t approve a void');
select throws_ok($$select public.void_order(jsonb_build_object('orderId', '01900000-0000-7000-8000-000000000001',
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'reason', 'Customer cancelled',
  'approvedBy', 'a2000000-0000-0000-0000-0000000000a9'), 'secret-one')$$,
  '42501', null, 'nor a manager from another outlet');
select throws_ok($$select public.void_order(jsonb_build_object('orderId', '01900000-0000-7000-8000-000000000001',
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'reason', '',
  'approvedBy', 'a2000000-0000-0000-0000-0000000000a8'), 'secret-one')$$,
  '22023', null, 'a void needs a reason');
select is(public.void_order(jsonb_build_object('orderId', '01900000-0000-7000-8000-000000000001',
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'reason', 'Customer cancelled',
  'approvedBy', 'a2000000-0000-0000-0000-0000000000a8'), 'secret-one') ->> 'status',
  'void', 'this outlet''s manager approves the void');
select is(public.void_order(jsonb_build_object('orderId', '01900000-0000-7000-8000-000000000001',
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'reason', 'Customer cancelled',
  'approvedBy', 'a2000000-0000-0000-0000-0000000000a8'), 'secret-one') ->> 'status',
  'already_void', 'voiding again is harmless');
reset role;

select is((select action || ':' || (details ->> 'reason') from public.audit_log), 'order.void:Customer cancelled',
  'the void is in the audit log, with the reason');

select * from finish();
rollback;
