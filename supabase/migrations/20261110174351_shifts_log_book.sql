-- Shifts and the log book (CLAUDE.md §5 item 5). A shift is one counter tablet's cash drawer for
-- a day: opened by counting the cash, cash in/out with a reason during the day, closed by counting
-- again. Recorded on the tablet (works offline) and synced through record_shift. The log book is
-- the shift_summaries view: who opened and closed, sales by mode, voids, cash movements, and the
-- expected cash against what was counted.

create table public.shifts (
  -- UUIDv7 made on the tablet.
  id uuid primary key,
  org_id uuid not null,
  outlet_id uuid not null,
  device_id uuid not null,
  business_date date not null,
  opened_at timestamptz not null,
  opened_by uuid references public.memberships (id) on delete set null,
  opened_by_name text not null check (length(trim(opened_by_name)) between 1 and 120),
  opening_cash_paise bigint not null check (opening_cash_paise >= 0),
  closed_at timestamptz,
  closed_by uuid references public.memberships (id) on delete set null,
  closed_by_name text,
  counted_cash_paise bigint check (counted_cash_paise >= 0),
  -- What the tablet expected at close. The view recomputes it from what has synced.
  expected_cash_paise bigint,
  note text check (length(note) <= 500),
  synced_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (outlet_id, org_id) references public.outlets (id, org_id),
  foreign key (device_id, org_id) references public.devices (id, org_id),
  check ((closed_at is null) = (counted_cash_paise is null))
);

-- One open drawer per tablet.
create unique index shifts_one_open_per_device on public.shifts (device_id) where closed_at is null;
create index shifts_org_id_idx on public.shifts (org_id);
create index shifts_outlet_day_idx on public.shifts (outlet_id, business_date);
create index shifts_opened_at_idx on public.shifts (opened_at);

create table public.cash_movements (
  -- UUIDv7 made on the tablet.
  id uuid primary key,
  org_id uuid not null,
  outlet_id uuid not null,
  shift_id uuid not null,
  kind text not null check (kind in ('in', 'out')),
  amount_paise bigint not null check (amount_paise > 0),
  reason text not null check (length(trim(reason)) between 1 and 200),
  by_membership uuid references public.memberships (id) on delete set null,
  by_name text not null,
  created_at timestamptz not null,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade,
  foreign key (outlet_id, org_id) references public.outlets (id, org_id)
);

create index cash_movements_org_id_idx on public.cash_movements (org_id);
create index cash_movements_outlet_id_idx on public.cash_movements (outlet_id);
create index cash_movements_shift_id_idx on public.cash_movements (shift_id);
create index cash_movements_created_at_idx on public.cash_movements (created_at);

-- Bills carry the shift they were billed in. No foreign key: a bill may sync before its shift.
alter table public.orders add column shift_id uuid;
create index orders_shift_id_idx on public.orders (shift_id);

revoke all on public.shifts, public.cash_movements from anon;
revoke insert, update, delete on public.shifts, public.cash_movements from authenticated;
alter table public.shifts enable row level security;
alter table public.cash_movements enable row level security;

create policy "staff read shifts at their outlets" on public.shifts
  for select to authenticated using (private.can_access_outlet(outlet_id));
create policy "staff read cash movements at their outlets" on public.cash_movements
  for select to authenticated using (private.can_access_outlet(outlet_id));

-- ---------------------------------------------------------------------------------------------
-- record_shift: open, cash in/out, close. Idempotent, so the outbox can resend safely.
--   { kind: 'open',  shift:    { id, deviceId, businessDate, openedAt, openedBy, openedByName, openingCashPaise } }
--   { kind: 'cash',  movement: { id, shiftId, kind, amountPaise, reason, by, byName, at } }
--   { kind: 'close', close:    { shiftId, closedAt, closedBy, closedByName, countedCashPaise, expectedCashPaise, note } }
-- ---------------------------------------------------------------------------------------------

create function public.record_shift(p jsonb, p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices;
  v_shift public.shifts;
  v_s jsonb;
  v_by uuid;
begin
  if p ->> 'kind' = 'open' then
    v_s := p -> 'shift';
    v_device := private.authorised_device((v_s ->> 'deviceId')::uuid, p_secret);
    if v_device.kind <> 'counter' then
      raise exception 'Only counter tablets keep a cash drawer.' using errcode = '22023';
    end if;
    v_by := (v_s ->> 'openedBy')::uuid;
  elsif p ->> 'kind' = 'cash' then
    v_s := p -> 'movement';
    v_by := (v_s ->> 'by')::uuid;
  elsif p ->> 'kind' = 'close' then
    v_s := p -> 'close';
    v_by := (v_s ->> 'closedBy')::uuid;
  else
    raise exception 'Unknown shift event.' using errcode = '22023';
  end if;

  if p ->> 'kind' <> 'open' then
    select * into v_shift from public.shifts where id = (v_s ->> 'shiftId')::uuid;
    if v_shift.id is null then
      -- The outbox always sends the open first, so this is a real problem, not a race.
      raise exception 'That shift isn''t on the server.' using errcode = '22023';
    end if;
    v_device := private.authorised_device(v_shift.device_id, p_secret);
  end if;

  if v_by is not null
     and not exists (select 1 from public.memberships where id = v_by and org_id = v_device.org_id) then
    raise exception 'Someone outside this business.' using errcode = '22023';
  end if;

  if p ->> 'kind' = 'open' then
    if exists (select 1 from public.shifts where id = (v_s ->> 'id')::uuid) then
      return jsonb_build_object('status', 'already_saved');
    end if;
    if exists (select 1 from public.shifts where device_id = v_device.id and closed_at is null) then
      raise exception 'This tablet already has an open day. Close it first.' using errcode = '23505';
    end if;
    insert into public.shifts (id, org_id, outlet_id, device_id, business_date, opened_at, opened_by,
                               opened_by_name, opening_cash_paise)
    values ((v_s ->> 'id')::uuid, v_device.org_id, v_device.outlet_id, v_device.id,
            (v_s ->> 'businessDate')::date, (v_s ->> 'openedAt')::timestamptz, v_by,
            v_s ->> 'openedByName', (v_s ->> 'openingCashPaise')::bigint);
  elsif p ->> 'kind' = 'cash' then
    insert into public.cash_movements (id, org_id, outlet_id, shift_id, kind, amount_paise, reason,
                                       by_membership, by_name, created_at)
    values ((v_s ->> 'id')::uuid, v_shift.org_id, v_shift.outlet_id, v_shift.id, v_s ->> 'kind',
            (v_s ->> 'amountPaise')::bigint, trim(v_s ->> 'reason'), v_by, v_s ->> 'byName',
            (v_s ->> 'at')::timestamptz)
    on conflict (id) do nothing;
  else
    update public.shifts set
      closed_at = (v_s ->> 'closedAt')::timestamptz,
      closed_by = v_by,
      closed_by_name = v_s ->> 'closedByName',
      counted_cash_paise = (v_s ->> 'countedCashPaise')::bigint,
      expected_cash_paise = (v_s ->> 'expectedCashPaise')::bigint,
      note = nullif(trim(coalesce(v_s ->> 'note', '')), '')
    where id = v_shift.id and closed_at is null;
  end if;

  update public.devices set last_seen_at = now() where id = v_device.id;
  return jsonb_build_object('status', 'saved');
end;
$$;

-- The open shift on this tablet, so a tablet whose storage was wiped carries on with it.
create function public.device_open_shift(p_device_id uuid, p_secret text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_device public.devices := private.authorised_device(p_device_id, p_secret);
  v_shift public.shifts;
begin
  select * into v_shift from public.shifts where device_id = v_device.id and closed_at is null;
  if v_shift.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_shift.id,
    'deviceId', v_shift.device_id,
    'businessDate', v_shift.business_date,
    'openedAt', v_shift.opened_at,
    'openedBy', v_shift.opened_by,
    'openedByName', v_shift.opened_by_name,
    'openingCashPaise', v_shift.opening_cash_paise,
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'shiftId', m.shift_id, 'kind', m.kind, 'amountPaise', m.amount_paise,
        'reason', m.reason, 'by', m.by_membership, 'byName', m.by_name, 'at', m.created_at
      ) order by m.created_at)
      from public.cash_movements m where m.shift_id = v_shift.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.record_shift, public.device_open_shift to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The log book: one row per shift, computed from synced bills and cash movements.
-- security_invoker, so each reader's own row level security applies.
-- ---------------------------------------------------------------------------------------------

create view public.shift_summaries with (security_invoker = true) as
select
  s.id, s.org_id, s.outlet_id, s.device_id, d.code as device_code, d.label as device_label,
  s.business_date, s.opened_at, s.opened_by_name, s.opening_cash_paise,
  s.closed_at, s.closed_by_name, s.counted_cash_paise, s.note,
  coalesce(o.bills, 0)::int as bills,
  coalesce(o.sales_paise, 0)::bigint as sales_paise,
  coalesce(o.voids, 0)::int as voids,
  coalesce(o.void_paise, 0)::bigint as void_paise,
  coalesce(pm.cash_paise, 0)::bigint as cash_sales_paise,
  coalesce(pm.upi_paise, 0)::bigint as upi_sales_paise,
  coalesce(pm.card_paise, 0)::bigint as card_sales_paise,
  coalesce(cm.cash_in_paise, 0)::bigint as cash_in_paise,
  coalesce(cm.cash_out_paise, 0)::bigint as cash_out_paise,
  (s.opening_cash_paise + coalesce(pm.cash_paise, 0) + coalesce(cm.cash_in_paise, 0)
    - coalesce(cm.cash_out_paise, 0))::bigint as expected_cash_paise,
  (s.counted_cash_paise - (s.opening_cash_paise + coalesce(pm.cash_paise, 0)
    + coalesce(cm.cash_in_paise, 0) - coalesce(cm.cash_out_paise, 0)))::bigint as difference_paise
from public.shifts s
join public.devices d on d.id = s.device_id
left join lateral (
  select count(*) filter (where ord.status = 'paid') as bills,
         sum(ord.total_paise) filter (where ord.status = 'paid') as sales_paise,
         count(*) filter (where ord.status = 'void') as voids,
         sum(ord.total_paise) filter (where ord.status = 'void') as void_paise
  from public.orders ord where ord.shift_id = s.id
) o on true
left join lateral (
  select sum(pay.amount_paise) filter (where pay.mode = 'cash') as cash_paise,
         sum(pay.amount_paise) filter (where pay.mode = 'upi') as upi_paise,
         sum(pay.amount_paise) filter (where pay.mode = 'card') as card_paise
  from public.payments pay join public.orders ord on ord.id = pay.order_id
  where ord.shift_id = s.id and ord.status = 'paid'
) pm on true
left join lateral (
  select sum(mv.amount_paise) filter (where mv.kind = 'in') as cash_in_paise,
         sum(mv.amount_paise) filter (where mv.kind = 'out') as cash_out_paise
  from public.cash_movements mv where mv.shift_id = s.id
) cm on true;

revoke all on public.shift_summaries from anon;
grant select on public.shift_summaries to authenticated;

-- Bills now record their shift. Same as before, plus shift_id.
create or replace function public.upsert_order(p jsonb, p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices := private.authorised_device((p ->> 'deviceId')::uuid, p_secret);
  v_outlet public.outlets;
  v_existing public.orders;
  v_billed_by uuid := (p -> 'billedBy' ->> 'membershipId')::uuid;
  v_line jsonb;
  v_payment jsonb;
  v_sum bigint := 0;
  v_paid bigint := 0;
  v_i int := 0;
  v_expected text;
begin
  select * into v_existing from public.orders where id = (p ->> 'id')::uuid;
  if v_existing.id is not null then
    if v_existing.device_id <> v_device.id then
      raise exception 'Bill id belongs to another device.' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_existing.id, 'billNumber', v_existing.bill_number, 'status', 'already_saved');
  end if;

  if (p ->> 'outletId')::uuid is distinct from v_device.outlet_id then
    raise exception 'This device bills for another outlet.' using errcode = '22023';
  end if;
  select * into v_outlet from public.outlets where id = v_device.outlet_id;

  v_expected := v_outlet.code || '-' || v_device.code || '/' || (p ->> 'financialYear') || '/'
    || lpad(p ->> 'billSeq', 6, '0');
  if p ->> 'billNumber' is distinct from v_expected then
    raise exception 'Bill number % should be %.', p ->> 'billNumber', v_expected using errcode = '22023';
  end if;

  if v_billed_by is not null
     and not exists (select 1 from public.memberships where id = v_billed_by and org_id = v_device.org_id) then
    raise exception 'Billed by someone outside this business.' using errcode = '22023';
  end if;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    v_sum := v_sum + (v_line ->> 'lineTotalPaise')::bigint;
  end loop;
  for v_payment in select * from jsonb_array_elements(p -> 'payments') loop
    v_paid := v_paid + (v_payment ->> 'amountPaise')::bigint;
  end loop;
  if jsonb_array_length(p -> 'lines') = 0 or v_sum <> (p -> 'totals' ->> 'itemTotalPaise')::bigint then
    raise exception 'Bill lines don''t add up.' using errcode = '22023';
  end if;
  if v_paid <> (p -> 'totals' ->> 'totalPaise')::bigint then
    raise exception 'Payments don''t add up to the bill.' using errcode = '22023';
  end if;

  insert into public.orders (
    id, org_id, outlet_id, device_id, financial_year, bill_seq, bill_number, business_date,
    order_type, customer_phone, billed_by, billed_by_name, gst_scheme, prices_include_tax,
    tax_rounding, item_total_paise, taxable_paise, cgst_paise, sgst_paise, round_off_paise,
    total_paise, created_at, shift_id
  ) values (
    (p ->> 'id')::uuid, v_device.org_id, v_device.outlet_id, v_device.id, p ->> 'financialYear',
    (p ->> 'billSeq')::int, p ->> 'billNumber', (p ->> 'businessDate')::date, p ->> 'orderType',
    p ->> 'customerPhone', v_billed_by, p -> 'billedBy' ->> 'name', p -> 'tax' ->> 'gstScheme',
    (p -> 'tax' ->> 'pricesIncludeTax')::boolean, p -> 'tax' ->> 'rounding',
    (p -> 'totals' ->> 'itemTotalPaise')::bigint, (p -> 'totals' ->> 'taxablePaise')::bigint,
    (p -> 'totals' ->> 'cgstPaise')::bigint, (p -> 'totals' ->> 'sgstPaise')::bigint,
    (p -> 'totals' ->> 'roundOffPaise')::bigint, (p -> 'totals' ->> 'totalPaise')::bigint,
    (p ->> 'createdAt')::timestamptz, (p ->> 'shiftId')::uuid
  );

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    insert into public.order_items (
      id, org_id, outlet_id, order_id, item_id, name, variant_name, modifiers, unit_paise, qty,
      tax_rate_bp, line_total_paise, sort
    ) values (
      (v_line ->> 'id')::uuid, v_device.org_id, v_device.outlet_id, (p ->> 'id')::uuid,
      (v_line ->> 'itemId')::uuid, v_line ->> 'name', v_line ->> 'variantName',
      coalesce(v_line -> 'modifiers', '[]'), (v_line ->> 'unitPaise')::bigint,
      (v_line ->> 'qty')::int, (v_line ->> 'taxRateBp')::int, (v_line ->> 'lineTotalPaise')::bigint, v_i
    );
    v_i := v_i + 1;
  end loop;

  for v_payment in select * from jsonb_array_elements(p -> 'payments') loop
    insert into public.payments (id, org_id, outlet_id, order_id, mode, amount_paise, tendered_paise, created_at)
    values (
      (v_payment ->> 'id')::uuid, v_device.org_id, v_device.outlet_id, (p ->> 'id')::uuid,
      (v_payment ->> 'mode')::public.payment_mode, (v_payment ->> 'amountPaise')::bigint,
      (v_payment ->> 'tenderedPaise')::bigint, (p ->> 'createdAt')::timestamptz
    );
  end loop;

  update public.devices set last_seen_at = now() where id = v_device.id;
  return jsonb_build_object('id', (p ->> 'id')::uuid, 'billNumber', p ->> 'billNumber', 'status', 'saved');
end;
$$;
