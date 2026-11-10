-- Staff management and tablet pairing.
--
--   owners     add, edit and switch off staff; pair and revoke counter tablets
--   managers   reset PINs of cashiers and kitchen staff at their own outlets; pair and revoke
--              tablets at their own outlets
--
-- New staff logins are created by the staff-create edge function (only the server can create
-- auth users), which then calls add_staff *as the owner*, so these checks apply.

-- ---------------------------------------------------------------------------------------------
-- PINs: managers only for cashiers and kitchen staff they share an outlet with.
-- ---------------------------------------------------------------------------------------------

create function private.can_manage_member(p_member public.memberships)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_member.org_id, '{owner}')
    or (
      p_member.role in ('cashier', 'kitchen')
      and exists (
        select 1 from public.memberships mine
        where mine.org_id = p_member.org_id
          and mine.user_id = (select auth.uid())
          and mine.is_active
          and mine.role = 'manager'
          and mine.outlet_ids && p_member.outlet_ids
      )
    );
$$;

create or replace function public.set_staff_pin(p_membership_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.memberships;
begin
  select * into v_member from public.memberships where id = p_membership_id;
  if v_member.id is null
     or not (v_member.user_id = (select auth.uid()) or private.can_manage_member(v_member))
  then
    raise exception 'You can''t set this PIN.' using errcode = '42501';
  end if;
  if not private.is_acceptable_pin(p_pin) then
    raise exception 'Use 4 digits that aren''t all the same or in a row.' using errcode = '22023';
  end if;

  insert into public.staff_pins (membership_id, pin_hash)
  values (p_membership_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (membership_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------------------------

create function private.outlets_in_org(p_org uuid, p_outlet_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(p_outlet_ids), 0) = (
    select count(*) from public.outlets where org_id = p_org and id = any (p_outlet_ids)
  );
$$;

-- p: { userId, orgId, name, phone?, role, outletIds, pin? }
-- userId must be a login this owner created in the last 10 minutes (staff-create does that).
create function public.add_staff(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (p ->> 'orgId')::uuid;
  v_user uuid := (p ->> 'userId')::uuid;
  v_role public.app_role := (p ->> 'role')::public.app_role;
  v_outlets uuid[] := array(select jsonb_array_elements_text(coalesce(p -> 'outletIds', '[]'))::uuid);
  v_membership uuid;
begin
  if not private.has_org_role(v_org, '{owner}') then
    raise exception 'Only the owner can add staff.' using errcode = '42501';
  end if;
  if v_role not in ('manager', 'cashier', 'kitchen') then
    raise exception 'Staff are managers, cashiers or kitchen.' using errcode = '22023';
  end if;
  if cardinality(v_outlets) = 0 or not private.outlets_in_org(v_org, v_outlets) then
    raise exception 'Pick at least one of your outlets.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = v_user
      and u.raw_app_meta_data ->> 'created_by' = (select auth.uid())::text
      and u.created_at > now() - interval '10 minutes'
  ) or exists (select 1 from public.profiles where id = v_user) then
    raise exception 'That login can''t be added as staff.' using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name, phone)
  values (v_user, trim(p ->> 'name'), nullif(regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g'), ''));

  insert into public.memberships (org_id, user_id, role, outlet_ids)
  values (v_org, v_user, v_role, v_outlets)
  returning id into v_membership;

  if nullif(p ->> 'pin', '') is not null then
    if not private.is_acceptable_pin(p ->> 'pin') then
      raise exception 'Use 4 digits that aren''t all the same or in a row.' using errcode = '22023';
    end if;
    insert into public.staff_pins (membership_id, pin_hash)
    values (v_membership, extensions.crypt(p ->> 'pin', extensions.gen_salt('bf', 8)));
  end if;

  return v_membership;
end;
$$;

-- p: { membershipId, name?, phone?, role?, outletIds?, isActive? }
-- The owner's own row: name and phone only.
create function public.update_staff(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.memberships;
  v_outlets uuid[];
begin
  select * into v_member from public.memberships where id = (p ->> 'membershipId')::uuid;
  if v_member.id is null or not private.has_org_role(v_member.org_id, '{owner}') then
    raise exception 'Only the owner can change staff.' using errcode = '42501';
  end if;

  if p ? 'name' or p ? 'phone' then
    update public.profiles set
      full_name = coalesce(nullif(trim(p ->> 'name'), ''), full_name),
      phone = case when p ? 'phone'
                   then nullif(regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g'), '')
                   else phone end
    where id = v_member.user_id;
  end if;

  if v_member.role = 'owner' then
    if p ? 'role' or p ? 'outletIds' or p ? 'isActive' then
      raise exception 'The owner''s role can''t be changed here.' using errcode = '22023';
    end if;
    return;
  end if;

  if p ? 'role' and (p ->> 'role') not in ('manager', 'cashier', 'kitchen') then
    raise exception 'Staff are managers, cashiers or kitchen.' using errcode = '22023';
  end if;
  if p ? 'outletIds' then
    v_outlets := array(select jsonb_array_elements_text(p -> 'outletIds')::uuid);
    if cardinality(v_outlets) = 0 or not private.outlets_in_org(v_member.org_id, v_outlets) then
      raise exception 'Pick at least one of your outlets.' using errcode = '22023';
    end if;
  end if;

  update public.memberships set
    role = coalesce((p ->> 'role')::public.app_role, role),
    outlet_ids = coalesce(v_outlets, outlet_ids),
    is_active = coalesce((p ->> 'isActive')::boolean, is_active)
  where id = v_member.id;
end;
$$;

-- Everyone an owner can manage (owners: all; managers: cashiers and kitchen at their outlets),
-- with whether they have a PIN (the hash itself never leaves the database).
create function public.list_staff(p_org_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'membershipId', m.id,
      'userId', m.user_id,
      'name', p.full_name,
      'phone', p.phone,
      'role', m.role,
      'outletIds', m.outlet_ids,
      'isActive', m.is_active,
      'hasPin', s.membership_id is not null,
      'emailLogin', u.email not like '%@staff.invalid',
      'email', case when u.email like '%@staff.invalid' then null else u.email end
    )
    order by m.is_active desc, (m.role = 'owner') desc, p.full_name
  ), '[]'::jsonb)
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  left join public.staff_pins s on s.membership_id = m.id
  where m.org_id = p_org_id
    and (private.has_org_role(p_org_id, '{owner}') or private.can_manage_member(m));
$$;

-- ---------------------------------------------------------------------------------------------
-- Tablet pairing: the owner gets a one-time code on their phone, the tablet types it in.
-- ---------------------------------------------------------------------------------------------

create table public.device_pairings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  outlet_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 60),
  code_hash text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  device_id uuid references public.devices (id) on delete set null,
  foreign key (outlet_id, org_id) references public.outlets (id, org_id) on delete cascade
);

create index device_pairings_org_id_idx on public.device_pairings (org_id);
create index device_pairings_outlet_id_idx on public.device_pairings (outlet_id);

-- Only the RPCs below touch pairings.
revoke all on public.device_pairings from anon, authenticated;
alter table public.device_pairings enable row level security;

-- Creates a counter tablet at an outlet and returns its secret (once). Shared by
-- register_device (owner signed in on the tablet) and pair_device (pairing code).
create function private.create_counter_device(p_org uuid, p_outlet_id uuid, p_label text, p_created_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next int;
  v_secret text := encode(extensions.gen_random_bytes(32), 'hex');
  v_device public.devices;
begin
  perform 1 from public.outlets where id = p_outlet_id for update;
  select coalesce(max(substr(code, 2)::int), 0) + 1 into v_next
  from public.devices where outlet_id = p_outlet_id;

  insert into public.devices (org_id, outlet_id, code, label, secret_hash, created_by)
  values (
    p_org, p_outlet_id, 'T' || v_next, trim(p_label),
    encode(extensions.digest(v_secret, 'sha256'), 'hex'), p_created_by
  )
  returning * into v_device;

  return jsonb_build_object(
    'deviceId', v_device.id,
    'outletId', v_device.outlet_id,
    'code', v_device.code,
    'label', v_device.label,
    'secret', v_secret
  );
end;
$$;

create or replace function public.register_device(p_outlet_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.outlets where id = p_outlet_id and is_active;
  if v_org is null
     or not private.has_org_role(v_org, '{owner,manager}')
     or not private.can_access_outlet(p_outlet_id)
  then
    raise exception 'You can''t register a device at this outlet.' using errcode = '42501';
  end if;
  return private.create_counter_device(v_org, p_outlet_id, p_label, (select auth.uid()));
end;
$$;

-- 8 characters from 31 without look-alikes (no 0/O, 1/I/L): 31^8 ≈ 8.5 × 10^11 codes.
create function public.create_pairing_code(p_outlet_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
  v_expires timestamptz := now() + interval '10 minutes';
begin
  select org_id into v_org from public.outlets where id = p_outlet_id and is_active;
  if v_org is null
     or not private.has_org_role(v_org, '{owner,manager}')
     or not private.can_access_outlet(p_outlet_id)
  then
    raise exception 'You can''t add a tablet at this outlet.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_label, ''))) = 0 then
    raise exception 'Name the tablet, like Counter tablet.' using errcode = '22023';
  end if;

  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;

  insert into public.device_pairings (org_id, outlet_id, label, code_hash, created_by, expires_at)
  values (v_org, p_outlet_id, trim(p_label), encode(extensions.digest(v_code, 'sha256'), 'hex'),
          (select auth.uid()), v_expires);

  return jsonb_build_object('code', v_code, 'expiresAt', v_expires);
end;
$$;

-- Called by the tablet before anyone is signed in; the code is the credential. Single use.
create function public.pair_device(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pairing public.device_pairings;
  v_device jsonb;
begin
  select * into v_pairing from public.device_pairings
  where code_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
    and used_at is null
    and expires_at > now()
  for update;

  if v_pairing.id is null then
    raise exception 'That code didn''t work. Codes last 10 minutes and work once.' using errcode = '28000';
  end if;

  v_device := private.create_counter_device(v_pairing.org_id, v_pairing.outlet_id, v_pairing.label, v_pairing.created_by);
  update public.device_pairings
    set used_at = now(), device_id = (v_device ->> 'deviceId')::uuid
    where id = v_pairing.id;
  return v_device;
end;
$$;

revoke all on function private.can_manage_member, private.outlets_in_org, private.create_counter_device
  from public, anon, authenticated;
grant execute on function public.add_staff, public.update_staff, public.list_staff,
  public.create_pairing_code to authenticated;
grant execute on function public.pair_device to anon, authenticated;
