-- PINs are exactly 4 digits, so the PIN pad can sign in on the fourth digit with no extra tap.
-- Still refused: one repeated digit (1111) and straight runs (1234, 9876).
create or replace function private.is_acceptable_pin(p_pin text)
returns boolean
language sql
immutable
as $$
  select p_pin ~ '^[0-9]{4}$'
    and p_pin !~ '^(.)\1+$'
    and position(p_pin in '0123456789') = 0
    and position(p_pin in '9876543210') = 0;
$$;

revoke all on function private.is_acceptable_pin from public, anon, authenticated;

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
     or not (
       v_member.user_id = (select auth.uid())
       or private.has_org_role(v_member.org_id, '{owner,manager}')
     )
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
