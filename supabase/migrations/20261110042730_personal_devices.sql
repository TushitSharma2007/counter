-- Personal devices: an owner's or manager's own phone also works as a counter at whichever outlet
-- they are at. Shared counter tablets stay as they were: one outlet, staff sign in with a PIN.
--
--   counter   shared tablet, fixed to one outlet, has a device secret, PIN sign-in
--   personal  one person's own phone/laptop, a row per outlet they bill at, no secret:
--             the person's own session proves who is billing. Never used for PIN sign-in.
--
-- Each row still gets its own code (T1, T2…) at its outlet, so bill series never clash.

alter table public.devices
  add column kind text not null default 'counter' check (kind in ('counter', 'personal')),
  add column user_id uuid references public.profiles (id) on delete cascade,
  alter column secret_hash drop not null;

alter table public.devices
  add constraint devices_kind_shape check (
    (kind = 'counter' and secret_hash is not null and user_id is null)
    or (kind = 'personal' and secret_hash is null and user_id is not null)
  );

-- One active personal device per person per outlet.
create unique index devices_one_personal_per_outlet
  on public.devices (outlet_id, user_id)
  where kind = 'personal' and revoked_at is null;

create index devices_user_id_idx on public.devices (user_id);

-- Only shared counter tablets can sign staff in with a PIN.
create or replace function private.device_outlet(p_device_id uuid, p_secret text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.outlet_id
  from public.devices d
  where d.id = p_device_id
    and d.kind = 'counter'
    and d.revoked_at is null
    and d.secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
$$;

revoke all on function private.device_outlet from public, anon, authenticated;

-- People can see their own personal devices, as well as managers seeing devices at their outlets.
drop policy "managers read devices at their outlets" on public.devices;
create policy "managers read devices at their outlets; people read their own" on public.devices
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (private.has_org_role(org_id, '{owner,manager}') and private.can_access_outlet(outlet_id))
  );

-- The caller's personal device at an outlet, created the first time. Idempotent.
create function public.ensure_personal_device(p_outlet_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_next int;
  v_device public.devices;
begin
  select org_id into v_org from public.outlets where id = p_outlet_id and is_active;
  if v_org is null
     or not private.has_org_role(v_org, '{owner,manager}')
     or not private.can_access_outlet(p_outlet_id)
  then
    raise exception 'You can''t bill at this outlet.' using errcode = '42501';
  end if;

  select * into v_device from public.devices
  where outlet_id = p_outlet_id and user_id = (select auth.uid())
    and kind = 'personal' and revoked_at is null;

  if v_device.id is null then
    -- Serialise code assignment per outlet (shared with register_device).
    perform 1 from public.outlets where id = p_outlet_id for update;
    select coalesce(max(substr(code, 2)::int), 0) + 1 into v_next
    from public.devices where outlet_id = p_outlet_id;

    insert into public.devices (org_id, outlet_id, code, label, kind, user_id, created_by)
    values (
      v_org, p_outlet_id, 'T' || v_next, trim(p_label), 'personal',
      (select auth.uid()), (select auth.uid())
    )
    returning * into v_device;
  end if;

  update public.devices set last_seen_at = now() where id = v_device.id;

  return jsonb_build_object(
    'deviceId', v_device.id,
    'outletId', v_device.outlet_id,
    'code', v_device.code,
    'label', v_device.label
  );
end;
$$;

grant execute on function public.ensure_personal_device to authenticated;
