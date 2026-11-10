-- Bills (CLAUDE.md §5 item 3, §7). A bill is made and numbered on the device, queued offline,
-- then sent here by upsert_order. Bills are never edited: a void is recorded on top, and the
-- audit log keeps who did it and why.

create type public.order_status as enum ('paid', 'void');
create type public.payment_mode as enum ('cash', 'upi', 'card', 'due');

alter table public.devices add constraint devices_id_org_key unique (id, org_id);

create table public.orders (
  -- UUIDv7 made on the device, so an offline bill keeps its id.
  id uuid primary key,
  org_id uuid not null,
  outlet_id uuid not null,
  device_id uuid not null,
  financial_year text not null check (financial_year ~ '^\d{4}$'),
  bill_seq int not null check (bill_seq > 0),
  bill_number text not null,
  business_date date not null,
  order_type text not null check (order_type in ('counter', 'takeaway', 'dine_in', 'delivery')),
  customer_phone text check (customer_phone ~ '^[6-9]\d{9}$'),
  billed_by uuid references public.memberships (id) on delete set null,
  billed_by_name text not null,
  gst_scheme text not null check (gst_scheme in ('regular', 'composition')),
  prices_include_tax boolean not null,
  tax_rounding text not null check (tax_rounding in ('line', 'bill')),
  item_total_paise bigint not null check (item_total_paise >= 0),
  taxable_paise bigint not null check (taxable_paise >= 0),
  cgst_paise bigint not null check (cgst_paise >= 0),
  sgst_paise bigint not null check (sgst_paise >= 0),
  round_off_paise bigint not null check (round_off_paise between -50 and 50),
  total_paise bigint not null check (total_paise >= 0),
  status public.order_status not null default 'paid',
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.memberships (id) on delete set null,
  -- When it was billed (device clock), and when it reached the server.
  created_at timestamptz not null,
  synced_at timestamptz not null default now(),
  unique (id, org_id),
  -- One running number per device per financial year; the device keeps the series gapless.
  unique (device_id, financial_year, bill_seq),
  foreign key (outlet_id, org_id) references public.outlets (id, org_id),
  foreign key (device_id, org_id) references public.devices (id, org_id),
  check ((status = 'void') = (voided_at is not null))
);

create table public.order_items (
  id uuid primary key,
  org_id uuid not null,
  outlet_id uuid not null,
  order_id uuid not null,
  item_id uuid,
  -- Copied onto the bill so later menu changes never alter it.
  name text not null,
  variant_name text,
  modifiers jsonb not null default '[]',
  unit_paise bigint not null check (unit_paise >= 0),
  qty int not null check (qty > 0),
  tax_rate_bp int not null,
  line_total_paise bigint not null check (line_total_paise = unit_paise * qty),
  sort int not null default 0,
  foreign key (order_id, org_id) references public.orders (id, org_id) on delete cascade
);

create table public.payments (
  id uuid primary key,
  org_id uuid not null,
  outlet_id uuid not null,
  order_id uuid not null,
  mode public.payment_mode not null,
  amount_paise bigint not null check (amount_paise > 0),
  -- Cash handed over, when it was more than the bill.
  tendered_paise bigint check (tendered_paise is null or tendered_paise >= amount_paise),
  created_at timestamptz not null,
  foreign key (order_id, org_id) references public.orders (id, org_id) on delete cascade
);

-- Who did what, for voids now; discounts, price changes and stock adjustments later (§7).
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  outlet_id uuid,
  actor_membership_id uuid references public.memberships (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index orders_org_id_idx on public.orders (org_id);
create index orders_outlet_day_idx on public.orders (outlet_id, business_date);
create index orders_created_at_idx on public.orders (created_at);
create index orders_customer_phone_idx on public.orders (org_id, customer_phone) where customer_phone is not null;
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_outlet_id_idx on public.order_items (outlet_id);
create index payments_order_id_idx on public.payments (order_id);
create index payments_outlet_id_idx on public.payments (outlet_id);
create index audit_log_org_created_idx on public.audit_log (org_id, created_at);

-- Reads: staff see bills at the outlets they work at (owners: all). Writes: RPCs only.
revoke all on public.orders, public.order_items, public.payments, public.audit_log from anon;
revoke insert, update, delete on public.orders, public.order_items, public.payments, public.audit_log
  from authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.audit_log enable row level security;

create policy "staff read bills at their outlets" on public.orders
  for select to authenticated using (private.can_access_outlet(outlet_id));
create policy "staff read bill lines at their outlets" on public.order_items
  for select to authenticated using (private.can_access_outlet(outlet_id));
create policy "staff read payments at their outlets" on public.payments
  for select to authenticated using (private.can_access_outlet(outlet_id));
create policy "owners read the audit log" on public.audit_log
  for select to authenticated using (private.has_org_role(org_id, '{owner}'));

-- ---------------------------------------------------------------------------------------------
-- The device sending a bill must be real and unrevoked: a counter tablet proves it with its
-- secret (so bills from an offline PIN sign-in still sync), a personal phone with its owner's login.
-- ---------------------------------------------------------------------------------------------

create function private.authorised_device(p_device_id uuid, p_secret text)
returns public.devices
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_device public.devices;
begin
  select * into v_device from public.devices where id = p_device_id and revoked_at is null;
  if v_device.id is null
     or (v_device.kind = 'counter'
         and v_device.secret_hash is distinct from encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex'))
     or (v_device.kind = 'personal' and v_device.user_id is distinct from (select auth.uid()))
  then
    raise exception 'This device isn''t registered any more.' using errcode = '28000';
  end if;
  return v_device;
end;
$$;

-- The last bill number this device used this year, so a device whose storage was wiped resumes.
create function public.device_last_bill_seq(p_device_id uuid, p_financial_year text, p_secret text default null)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_device public.devices := private.authorised_device(p_device_id, p_secret);
begin
  return coalesce((
    select max(bill_seq) from public.orders
    where device_id = v_device.id and financial_year = p_financial_year
  ), 0);
end;
$$;

-- p: the OrderPayload from @repo/pos-core. Idempotent: sending the same bill again is harmless.
create function public.upsert_order(p jsonb, p_secret text default null)
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
    total_paise, created_at
  ) values (
    (p ->> 'id')::uuid, v_device.org_id, v_device.outlet_id, v_device.id, p ->> 'financialYear',
    (p ->> 'billSeq')::int, p ->> 'billNumber', (p ->> 'businessDate')::date, p ->> 'orderType',
    p ->> 'customerPhone', v_billed_by, p -> 'billedBy' ->> 'name', p -> 'tax' ->> 'gstScheme',
    (p -> 'tax' ->> 'pricesIncludeTax')::boolean, p -> 'tax' ->> 'rounding',
    (p -> 'totals' ->> 'itemTotalPaise')::bigint, (p -> 'totals' ->> 'taxablePaise')::bigint,
    (p -> 'totals' ->> 'cgstPaise')::bigint, (p -> 'totals' ->> 'sgstPaise')::bigint,
    (p -> 'totals' ->> 'roundOffPaise')::bigint, (p -> 'totals' ->> 'totalPaise')::bigint,
    (p ->> 'createdAt')::timestamptz
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

-- p: { orderId, deviceId, reason, approvedBy (membershipId), at }.
-- The approver's manager PIN is checked on the device (works offline); the server checks they
-- are a manager or owner who can work at this outlet. Idempotent.
create function public.void_order(p jsonb, p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices := private.authorised_device((p ->> 'deviceId')::uuid, p_secret);
  v_order public.orders;
  v_approver public.memberships;
begin
  select * into v_order from public.orders where id = (p ->> 'orderId')::uuid for update;
  if v_order.id is null or v_order.outlet_id <> v_device.outlet_id then
    raise exception 'That bill isn''t from this outlet.' using errcode = '22023';
  end if;
  if v_order.status = 'void' then
    return jsonb_build_object('id', v_order.id, 'status', 'already_void');
  end if;
  if length(trim(coalesce(p ->> 'reason', ''))) < 3 then
    raise exception 'Say why the bill is void.' using errcode = '22023';
  end if;

  select * into v_approver from public.memberships
  where id = (p ->> 'approvedBy')::uuid and org_id = v_order.org_id
    and role in ('owner', 'manager')
    and (role = 'owner' or v_order.outlet_id = any (outlet_ids));
  if v_approver.id is null then
    raise exception 'A manager or the owner must approve a void.' using errcode = '42501';
  end if;

  update public.orders set
    status = 'void', void_reason = trim(p ->> 'reason'),
    voided_at = coalesce((p ->> 'at')::timestamptz, now()), voided_by = v_approver.id
  where id = v_order.id;

  insert into public.audit_log (org_id, outlet_id, actor_membership_id, action, entity, entity_id, details)
  values (
    v_order.org_id, v_order.outlet_id, v_approver.id, 'order.void', 'order', v_order.id,
    jsonb_build_object('billNumber', v_order.bill_number, 'totalPaise', v_order.total_paise,
                       'reason', trim(p ->> 'reason'), 'deviceId', v_device.id)
  );

  return jsonb_build_object('id', v_order.id, 'status', 'void');
end;
$$;

revoke all on function private.authorised_device from public, anon, authenticated;
grant execute on function public.upsert_order, public.void_order, public.device_last_bill_seq
  to anon, authenticated;
