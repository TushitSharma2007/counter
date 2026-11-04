-- Demo tenant for local development (CLAUDE.md §9: realistic Indian café data).
-- Local-only logins: see the staff block at the end. Never run this seed against production.

insert into public.orgs (id, name, slug, modules, gst_scheme, prices_include_tax)
values (
  '0193a000-0000-7000-8000-000000000001',
  'Demo Coffee Co.',
  'demo-coffee',
  array['pos', 'kds', 'loyalty', 'multi_outlet'],
  'regular',
  true
);

insert into public.outlets (id, org_id, name, code, address, city) values
  ('0193a000-0000-7000-8000-000000000101', '0193a000-0000-7000-8000-000000000001',
   'Arera Colony', 'ARC', 'E-5, Arera Colony', 'Bhopal'),
  ('0193a000-0000-7000-8000-000000000102', '0193a000-0000-7000-8000-000000000001',
   'MP Nagar', 'MPN', 'Zone II, MP Nagar', 'Bhopal'),
  ('0193a000-0000-7000-8000-000000000103', '0193a000-0000-7000-8000-000000000001',
   'New Market', 'NWM', 'TT Nagar, New Market', 'Bhopal');

-- Staff ----------------------------------------------------------------------------------------
-- Owner signs in with email + password. Everyone else uses a PIN on a registered device.
--   Owner     Aditi Verma    owner@demo-coffee.test / demo-owner-2026   all outlets
--   Manager   Rohan Mehta    PIN 2580                                   Arera Colony, MP Nagar
--   Cashier   Priya Sharma   PIN 1357                                   Arera Colony
--   Cashier   Imran Khan     PIN 2468                                   MP Nagar
--   Cashier   Kavya Joshi    PIN 3691                                   New Market
--   Kitchen   Suresh Patel   PIN 9024                                   Arera Colony

do $$
declare
  arc constant uuid := '0193a000-0000-7000-8000-000000000101';
  mpn constant uuid := '0193a000-0000-7000-8000-000000000102';
  nwm constant uuid := '0193a000-0000-7000-8000-000000000103';
  org constant uuid := '0193a000-0000-7000-8000-000000000001';
  staff record;
begin
  for staff in
    select * from (values
      ('0193a000-0000-7000-8000-000000000201'::uuid, 'Aditi Verma', 'owner@demo-coffee.test',
       'demo-owner-2026', 'owner'::public.app_role, '{}'::uuid[], null),
      ('0193a000-0000-7000-8000-000000000202', 'Rohan Mehta', 'rohan@demo-coffee.test',
       null, 'manager', array[arc, mpn], '2580'),
      ('0193a000-0000-7000-8000-000000000203', 'Priya Sharma', 'priya@demo-coffee.test',
       null, 'cashier', array[arc], '1357'),
      ('0193a000-0000-7000-8000-000000000204', 'Imran Khan', 'imran@demo-coffee.test',
       null, 'cashier', array[mpn], '2468'),
      ('0193a000-0000-7000-8000-000000000205', 'Kavya Joshi', 'kavya@demo-coffee.test',
       null, 'cashier', array[nwm], '3691'),
      ('0193a000-0000-7000-8000-000000000206', 'Suresh Patel', 'suresh@demo-coffee.test',
       null, 'kitchen', array[arc], '9024')
    ) as s (id, full_name, email, password, role, outlet_ids, pin)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', staff.id, 'authenticated', 'authenticated',
      staff.email,
      -- PIN-only staff get an unguessable password nobody knows.
      extensions.crypt(coalesce(staff.password, encode(extensions.gen_random_bytes(24), 'hex')),
                       extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), staff.id, staff.id::text, 'email',
      jsonb_build_object('sub', staff.id::text, 'email', staff.email, 'email_verified', true),
      now(), now(), now()
    );

    insert into public.profiles (id, full_name) values (staff.id, staff.full_name);

    insert into public.memberships (org_id, user_id, role, outlet_ids)
    values (org, staff.id, staff.role, staff.outlet_ids);

    if staff.pin is not null then
      insert into public.staff_pins (membership_id, pin_hash)
      select m.id, extensions.crypt(staff.pin, extensions.gen_salt('bf', 8))
      from public.memberships m where m.user_id = staff.id;
    end if;
  end loop;
end;
$$;
