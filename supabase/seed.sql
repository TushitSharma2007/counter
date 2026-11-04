-- Demo tenant for local development (CLAUDE.md §9: realistic Indian café data).
-- Staff logins are added with the auth milestone.

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
