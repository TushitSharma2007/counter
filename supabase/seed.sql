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

-- Menu -------------------------------------------------------------------------------------------
-- Prices are tax-inclusive, 5% GST (restaurant service). Coffees come Regular or Large.

do $$
declare
  org constant uuid := '0193a000-0000-7000-8000-000000000001';
  mpn constant uuid := '0193a000-0000-7000-8000-000000000102';
  cat record;
  it record;
  milk uuid;
  extras uuid;
  item_id uuid;
begin
  for cat in
    select * from (values
      (1, 'Hot Coffee'), (2, 'Cold Coffee'), (3, 'Tea'), (4, 'Shakes'), (5, 'Snacks'), (6, 'Desserts')
    ) as c (sort, name)
  loop
    insert into public.categories (org_id, name, sort) values (org, cat.name, cat.sort);
  end loop;

  insert into public.modifier_groups (org_id, name, sort) values (org, 'Milk', 1) returning id into milk;
  insert into public.modifier_groups (org_id, name, sort) values (org, 'Extras', 2) returning id into extras;
  insert into public.modifiers (org_id, group_id, name, price_paise, sort) values
    (org, milk, 'Oat milk', 5000, 0), (org, milk, 'Almond milk', 5000, 1),
    (org, extras, 'Extra shot', 4000, 0), (org, extras, 'Hazelnut syrup', 3000, 1),
    (org, extras, 'Whipped cream', 3000, 2);

  -- code, name, category, food, price, large price (null = one size), add-on groups
  for it in
    select * from (values
      ('ESP', 'Espresso', 'Hot Coffee', 'veg', 9900, null, 'extras'),
      ('AME', 'Americano', 'Hot Coffee', 'veg', 12900, null, 'extras'),
      ('CAP', 'Cappuccino', 'Hot Coffee', 'veg', 14900, 18900, 'milk,extras'),
      ('LAT', 'Café Latte', 'Hot Coffee', 'veg', 15900, 19900, 'milk,extras'),
      ('HZL', 'Hazelnut Latte', 'Hot Coffee', 'veg', 17900, 21900, 'milk,extras'),
      ('MOC', 'Mocha', 'Hot Coffee', 'veg', 18900, 22900, 'milk,extras'),
      ('FLT', 'Filter Coffee', 'Hot Coffee', 'veg', 7900, null, ''),
      ('CC', 'Cold Coffee', 'Cold Coffee', 'veg', 14900, 18900, 'milk,extras'),
      ('IAM', 'Iced Americano', 'Cold Coffee', 'veg', 14900, null, 'extras'),
      ('IMO', 'Iced Mocha', 'Cold Coffee', 'veg', 18900, null, 'milk,extras'),
      ('CBR', 'Cold Brew', 'Cold Coffee', 'veg', 19900, null, ''),
      ('FHZ', 'Hazelnut Frappé', 'Cold Coffee', 'veg', 21900, null, 'milk,extras'),
      ('CHA', 'Masala Chai', 'Tea', 'veg', 4900, null, ''),
      ('GCH', 'Ginger Chai', 'Tea', 'veg', 4900, null, ''),
      ('LIT', 'Lemon Iced Tea', 'Tea', 'veg', 9900, null, ''),
      ('GRT', 'Green Tea', 'Tea', 'veg', 8900, null, ''),
      ('ORS', 'Oreo Shake', 'Shakes', 'veg', 17900, null, ''),
      ('CHS', 'Chocolate Shake', 'Shakes', 'veg', 16900, null, ''),
      ('MGS', 'Mango Shake', 'Shakes', 'veg', 15900, null, ''),
      ('VPF', 'Veg Puff', 'Snacks', 'veg', 3900, null, ''),
      ('PPF', 'Paneer Puff', 'Snacks', 'veg', 4900, null, ''),
      ('EPF', 'Egg Puff', 'Snacks', 'egg', 4500, null, ''),
      ('CPF', 'Chicken Puff', 'Snacks', 'nonveg', 5900, null, ''),
      ('PSW', 'Paneer Sandwich', 'Snacks', 'veg', 11900, null, ''),
      ('CSW', 'Chicken Sandwich', 'Snacks', 'nonveg', 14900, null, ''),
      ('FRI', 'Masala Fries', 'Snacks', 'veg', 9900, null, ''),
      ('GBR', 'Garlic Bread', 'Snacks', 'veg', 10900, null, ''),
      ('LAV', 'Choco Lava Cake', 'Desserts', 'egg', 12900, null, ''),
      ('BRW', 'Walnut Brownie', 'Desserts', 'egg', 9900, null, ''),
      ('CHK', 'Blueberry Cheesecake', 'Desserts', 'egg', 17900, null, '')
    ) as i (code, name, category, food, price, large, groups)
  loop
    insert into public.items (org_id, category_id, name, code, food, price_paise, tax_rate_bp, sort)
    select org, c.id, it.name, it.code, it.food::public.food_type, it.price, 500,
           (select count(*) from public.items where org_id = org)
    from public.categories c where c.org_id = org and c.name = it.category
    returning id into item_id;

    if it.large is not null then
      insert into public.item_variants (org_id, item_id, name, price_paise, sort) values
        (org, item_id, 'Regular', it.price, 0), (org, item_id, 'Large', it.large, 1);
    end if;
    if it.groups like '%milk%' then
      insert into public.item_modifier_groups (org_id, item_id, group_id, sort) values (org, item_id, milk, 0);
    end if;
    if it.groups like '%extras%' then
      insert into public.item_modifier_groups (org_id, item_id, group_id, sort) values (org, item_id, extras, 1);
    end if;
  end loop;

  -- Mango Shake is sold out at MP Nagar today.
  insert into public.item_outlet_overrides (org_id, outlet_id, item_id, is_available)
  select org, mpn, id, false from public.items where org_id = org and code = 'MGS';
end;
$$;
