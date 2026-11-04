-- Staff auth at the counter (CLAUDE.md §4): registered devices and cashier PINs.
-- Owners and managers sign in with email + password. Everyone else taps their name on a
-- registered device and enters a PIN; the auth-pin edge function turns that into a session.

-- ---------------------------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  -- Part of the device's bill series (ARC-T2/2526/000123). Never reused, even after revoking.
  code text not null check (code ~ '^T[0-9]{1,3}$'),
  label text not null check (length(trim(label)) between 1 and 60),
  -- sha256 of the device secret. The secret itself lives only on the device.
  secret_hash text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  unique (outlet_id, code)
);

create index devices_org_id_idx on public.devices (org_id);
create index devices_outlet_id_idx on public.devices (outlet_id);

revoke all on public.devices from anon;
alter table public.devices enable row level security;

-- Devices are created and revoked only through the RPCs below.
create policy "managers read devices at their outlets" on public.devices
  for select to authenticated
  using (
    private.has_org_role(org_id, '{owner,manager}') and private.can_access_outlet(outlet_id)
  );

-- ---------------------------------------------------------------------------------------------
-- Staff PINs: never readable by clients. Registered devices get the hashes through
-- device_roster() so cashiers can switch while offline.
-- ---------------------------------------------------------------------------------------------

create table public.staff_pins (
  membership_id uuid primary key references public.memberships (id) on delete cascade,
  pin_hash text not null,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on public.staff_pins from anon, authenticated;
alter table public.staff_pins enable row level security;

-- Roles that sign in with a PIN. Owners always use email + password, so a shared counter
-- device can never hold an owner session.
create function private.pin_roles()
returns public.app_role[]
language sql
immutable
as $$ select '{manager,cashier,kitchen}'::public.app_role[] $$;

-- The outlet of a registered, unrevoked device, or null if the id/secret pair is wrong.
create function private.device_outlet(p_device_id uuid, p_secret text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.outlet_id
  from public.devices d
  where d.id = p_device_id
    and d.revoked_at is null
    and d.secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
$$;

-- 4 to 6 digits, not one repeated digit, not a straight run like 1234 or 9876.
create function private.is_acceptable_pin(p_pin text)
returns boolean
language sql
immutable
as $$
  select p_pin ~ '^[0-9]{4,6}$'
    and p_pin !~ '^(.)\1+$'
    and position(p_pin in '0123456789') = 0
    and position(p_pin in '9876543210') = 0;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Registers the calling browser as a counter device. Returns the secret once.
create function public.register_device(p_outlet_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_next int;
  v_secret text;
  v_device public.devices;
begin
  select org_id into v_org from public.outlets where id = p_outlet_id and is_active;
  if v_org is null
     or not private.has_org_role(v_org, '{owner,manager}')
     or not private.can_access_outlet(p_outlet_id)
  then
    raise exception 'You can''t register a device at this outlet.' using errcode = '42501';
  end if;

  -- Serialise code assignment per outlet.
  perform 1 from public.outlets where id = p_outlet_id for update;
  select coalesce(max(substr(code, 2)::int), 0) + 1 into v_next
  from public.devices where outlet_id = p_outlet_id;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.devices (org_id, outlet_id, code, label, secret_hash, created_by)
  values (
    v_org, p_outlet_id, 'T' || v_next, trim(p_label),
    encode(extensions.digest(v_secret, 'sha256'), 'hex'), (select auth.uid())
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

create function public.revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices;
begin
  select * into v_device from public.devices where id = p_device_id;
  if v_device.id is null
     or not private.has_org_role(v_device.org_id, '{owner,manager}')
     or not private.can_access_outlet(v_device.outlet_id)
  then
    raise exception 'You can''t revoke this device.' using errcode = '42501';
  end if;
  update public.devices set revoked_at = coalesce(revoked_at, now()) where id = p_device_id;
end;
$$;

-- Owners and managers set PINs for their staff; anyone can change their own.
create function public.set_staff_pin(p_membership_id uuid, p_pin text)
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
     or not (
       v_member.user_id = (select auth.uid())
       or private.has_org_role(v_member.org_id, '{owner,manager}')
     )
  then
    raise exception 'You can''t set this PIN.' using errcode = '42501';
  end if;
  if not private.is_acceptable_pin(p_pin) then
    raise exception 'Use 4 to 6 digits that aren''t all the same or in a row.' using errcode = '22023';
  end if;

  insert into public.staff_pins (membership_id, pin_hash)
  values (p_membership_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (membership_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

-- What a registered device shows on its PIN screen, plus PIN hashes for offline switching.
-- Called before anyone is signed in, so it is open to anon; the device secret is the credential.
create function public.device_roster(p_device_id uuid, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outlet_id uuid := private.device_outlet(p_device_id, p_secret);
  v_result jsonb;
begin
  if v_outlet_id is null then
    raise exception 'This device isn''t registered any more.' using errcode = '28000';
  end if;

  update public.devices set last_seen_at = now() where id = p_device_id;

  select jsonb_build_object(
    'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'code', o.code, 'orgName', g.name),
    'device', jsonb_build_object('id', d.id, 'code', d.code, 'label', d.label),
    'staff', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'membershipId', m.id, 'name', p.full_name, 'role', m.role, 'pinHash', s.pin_hash
        )
        order by p.full_name
      )
      from public.memberships m
      join public.profiles p on p.id = m.user_id
      join public.staff_pins s on s.membership_id = m.id
      where m.org_id = o.org_id
        and m.is_active
        and m.role = any (private.pin_roles())
        and o.id = any (m.outlet_ids)
    ), '[]'::jsonb)
  )
  into v_result
  from public.devices d
  join public.outlets o on o.id = d.outlet_id
  join public.orgs g on g.id = o.org_id
  where d.id = p_device_id;

  return v_result;
end;
$$;

-- Checks a PIN typed on a registered device. Server-only (the auth-pin edge function).
-- Failures are returned, not raised, so the attempt counter isn't rolled back.
-- Five wrong PINs lock that person out for five minutes.
create function public.verify_staff_pin(
  p_device_id uuid, p_secret text, p_membership_id uuid, p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outlet_id uuid := private.device_outlet(p_device_id, p_secret);
  v_pin public.staff_pins;
  v_user_id uuid;
  v_attempts int;
begin
  if v_outlet_id is null then
    return jsonb_build_object('ok', false, 'reason', 'device');
  end if;

  select s.*, m.user_id into v_pin.membership_id, v_pin.pin_hash, v_pin.failed_attempts,
    v_pin.locked_until, v_pin.updated_at, v_user_id
  from public.staff_pins s
  join public.memberships m on m.id = s.membership_id
  where s.membership_id = p_membership_id
    and m.is_active
    and m.role = any (private.pin_roles())
    and v_outlet_id = any (m.outlet_ids)
  for update of s;

  if v_pin.membership_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_here');
  end if;

  if v_pin.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'until', v_pin.locked_until);
  end if;

  if extensions.crypt(p_pin, v_pin.pin_hash) = v_pin.pin_hash then
    update public.staff_pins set failed_attempts = 0, locked_until = null
      where membership_id = p_membership_id;
    update public.devices set last_seen_at = now() where id = p_device_id;
    return jsonb_build_object(
      'ok', true,
      'userId', v_user_id,
      'email', (select email from auth.users where id = v_user_id)
    );
  end if;

  v_attempts := v_pin.failed_attempts + 1;
  if v_attempts >= 5 then
    update public.staff_pins
      set failed_attempts = 0, locked_until = now() + interval '5 minutes'
      where membership_id = p_membership_id;
    return jsonb_build_object('ok', false, 'reason', 'locked', 'until', now() + interval '5 minutes');
  end if;

  update public.staff_pins set failed_attempts = v_attempts where membership_id = p_membership_id;
  return jsonb_build_object('ok', false, 'reason', 'wrong_pin', 'triesLeft', 5 - v_attempts);
end;
$$;

-- The private helpers are only called from the security definer RPCs above.
revoke all on function private.pin_roles, private.device_outlet, private.is_acceptable_pin
  from public, anon, authenticated;

grant execute on function public.register_device, public.revoke_device, public.set_staff_pin
  to authenticated;
grant execute on function public.device_roster to anon, authenticated;
grant execute on function public.verify_staff_pin to service_role;
