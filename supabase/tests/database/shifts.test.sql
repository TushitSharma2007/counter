-- Shifts: only counter tablets keep a drawer, one open at a time, events are idempotent, and the
-- log book adds up opening cash + cash sales + cash in - cash out against the counted cash.
begin;
select plan(14);


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

create function pg_temp.open_shift(p_id text, p_device text, p_cash bigint default 200000)
returns jsonb language sql as $$
  select jsonb_build_object('kind', 'open', 'shift', jsonb_build_object(
    'id', p_id, 'deviceId', p_device, 'businessDate', '2026-11-10', 'openedAt', '2026-11-10T03:00:00Z',
    'openedBy', 'a2000000-0000-0000-0000-0000000000a1', 'openedByName', 'Cashier A1', 'openingCashPaise', p_cash));
$$;
create function pg_temp.cash(p_id text, p_kind text, p_amount bigint, p_reason text default 'Milk from the dairy')
returns jsonb language sql as $$
  select jsonb_build_object('kind', 'cash', 'movement', jsonb_build_object(
    'id', p_id, 'shiftId', '01900000-0000-7000-8000-0000000000f1', 'kind', p_kind, 'amountPaise', p_amount,
    'reason', p_reason, 'by', 'a2000000-0000-0000-0000-0000000000a1', 'byName', 'Cashier A1',
    'at', '2026-11-10T07:00:00Z'));
$$;
grant execute on function pg_temp.open_shift, pg_temp.cash to anon, authenticated;

set local role anon;
select is(public.record_shift(pg_temp.open_shift('01900000-0000-7000-8000-0000000000f1', 'd0000000-0000-0000-0000-000000000001'), 'secret-one') ->> 'status',
  'saved', 'a counter tablet opens the day with ₹2,000 in the drawer');
select is(public.record_shift(pg_temp.open_shift('01900000-0000-7000-8000-0000000000f1', 'd0000000-0000-0000-0000-000000000001'), 'secret-one') ->> 'status',
  'already_saved', 'sending the open again is harmless');
select throws_ok($$select public.record_shift(pg_temp.open_shift('01900000-0000-7000-8000-0000000000f2', 'd0000000-0000-0000-0000-000000000001'), 'secret-one')$$,
  '23505', null, 'one open day per tablet');
select throws_ok($$select public.record_shift(pg_temp.open_shift('01900000-0000-7000-8000-0000000000f3', 'd0000000-0000-0000-0000-000000000001'), 'wrong')$$,
  '28000', null, 'a wrong device key is refused');
select is(public.device_open_shift('d0000000-0000-0000-0000-000000000001', 'secret-one') ->> 'id',
  '01900000-0000-7000-8000-0000000000f1', 'a wiped tablet finds its open day');

select is(public.record_shift(pg_temp.cash('01900000-0000-7000-8000-0000000000c1', 'out', 45000), 'secret-one') ->> 'status',
  'saved', 'cash out for milk');
select is(public.record_shift(pg_temp.cash('01900000-0000-7000-8000-0000000000c1', 'out', 45000), 'secret-one') ->> 'status',
  'saved', 'sending it again is harmless');
select is(public.record_shift(pg_temp.cash('01900000-0000-7000-8000-0000000000c2', 'in', 50000, 'Change from the bank'), 'secret-one') ->> 'status',
  'saved', 'cash in for change');
select throws_ok($$select public.record_shift(pg_temp.cash('01900000-0000-7000-8000-0000000000c3', 'out', 100, ' '), 'secret-one')$$,
  '23514', null, 'cash in or out needs a reason');

-- Two bills in the shift: one ₹149 cash, one ₹149 UPI.
select public.upsert_order(pg_temp.bill('01900000-0000-7000-8000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'T1', 1)
  || jsonb_build_object('shiftId', '01900000-0000-7000-8000-0000000000f1'), 'secret-one');
select public.upsert_order(jsonb_set(pg_temp.bill('01900000-0000-7000-8000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'T1', 2),
  '{payments,0,mode}', '"upi"') || jsonb_build_object('shiftId', '01900000-0000-7000-8000-0000000000f1'), 'secret-one');

select is(public.record_shift(jsonb_build_object('kind', 'close', 'close', jsonb_build_object(
  'shiftId', '01900000-0000-7000-8000-0000000000f1', 'closedAt', '2026-11-10T16:00:00Z',
  'closedBy', 'a2000000-0000-0000-0000-0000000000a1', 'closedByName', 'Cashier A1',
  'countedCashPaise', 215000, 'expectedCashPaise', 219900, 'note', 'Short by a ₹50 note')), 'secret-one') ->> 'status',
  'saved', 'the day closes with the counted cash');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a"}', true);
select is((select expected_cash_paise from public.shift_summaries), 219900::bigint,
  'expected cash = ₹2,000 opening + ₹149 cash sales + ₹500 in - ₹450 out');
select is((select difference_paise || '/' || bills || '/' || upi_sales_paise from public.shift_summaries),
  '-4900/2/14900', 'the log book shows ₹49 short, 2 bills, ₹149 by UPI');
select throws_ok($$update public.shifts set counted_cash_paise = 0$$, '42501', null,
  'no one edits the log book directly');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b"}', true);
select is((select count(*) from public.shift_summaries), 0::bigint, 'owner B sees none of A''s log book');
reset role;

select * from finish();
rollback;
