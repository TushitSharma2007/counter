-- Menu (CLAUDE.md §5 item 2): categories, items with sizes and add-ons, GST slab, food mark,
-- and per-outlet prices and availability.
--
-- Who can do what:
--   everyone at the business   reads the menu (cashiers bill from it)
--   owner                      edits the menu and prices
--   manager                    marks items sold out / sets outlet prices at their own outlets
-- Items and categories are switched off, never deleted, so past bills keep their history.
-- Composite foreign keys (id, org_id) make it impossible to point at another tenant's rows.

create type public.food_type as enum ('veg', 'nonveg', 'egg');

-- Targets for the composite foreign keys below.
alter table public.outlets add constraint outlets_id_org_key unique (id, org_id);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, name)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  category_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  -- Short code for keyboard billing: CC, HZL, VPF.
  code text not null check (code ~ '^[A-Z0-9]{1,6}$'),
  food public.food_type not null default 'veg',
  -- The price when the item has no sizes. With sizes, each size has its own price.
  price_paise bigint not null check (price_paise >= 0),
  tax_rate_bp int not null default 500 check (tax_rate_bp in (0, 500, 1200, 1800, 2800)),
  description text check (length(description) <= 300),
  image_path text,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, code),
  foreign key (category_id, org_id) references public.categories (id, org_id)
);

create table public.item_variants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  item_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 30),
  price_paise bigint not null check (price_paise >= 0),
  sort int not null default 0,
  unique (id, org_id),
  unique (item_id, name),
  foreign key (item_id, org_id) references public.items (id, org_id) on delete cascade
);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, name)
);

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  group_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 40),
  price_paise bigint not null default 0 check (price_paise >= 0),
  sort int not null default 0,
  is_active boolean not null default true,
  unique (group_id, name),
  foreign key (group_id, org_id) references public.modifier_groups (id, org_id) on delete cascade
);

create table public.item_modifier_groups (
  org_id uuid not null,
  item_id uuid not null,
  group_id uuid not null,
  sort int not null default 0,
  primary key (item_id, group_id),
  foreign key (item_id, org_id) references public.items (id, org_id) on delete cascade,
  foreign key (group_id, org_id) references public.modifier_groups (id, org_id) on delete cascade
);

-- One row per outlet + item (+ size). No row means: menu price, available.
create table public.item_outlet_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  outlet_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  price_paise bigint check (price_paise >= 0),
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (outlet_id, item_id, variant_id),
  foreign key (outlet_id, org_id) references public.outlets (id, org_id) on delete cascade,
  foreign key (item_id, org_id) references public.items (id, org_id) on delete cascade,
  foreign key (variant_id, org_id) references public.item_variants (id, org_id) on delete cascade
);

create index categories_org_id_idx on public.categories (org_id);
create index items_org_id_idx on public.items (org_id);
create index items_category_id_idx on public.items (category_id);
create index item_variants_item_id_idx on public.item_variants (item_id);
create index modifier_groups_org_id_idx on public.modifier_groups (org_id);
create index modifiers_group_id_idx on public.modifiers (group_id);
create index item_modifier_groups_org_id_idx on public.item_modifier_groups (org_id);
create index item_outlet_overrides_outlet_id_idx on public.item_outlet_overrides (outlet_id);
create index item_outlet_overrides_org_id_idx on public.item_outlet_overrides (org_id);

create trigger items_touch_updated_at before update on public.items
  for each row execute function private.touch_updated_at();
create trigger item_outlet_overrides_touch_updated_at before update on public.item_outlet_overrides
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

revoke all on public.categories, public.items, public.item_variants, public.modifier_groups,
  public.modifiers, public.item_modifier_groups, public.item_outlet_overrides from anon;

alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.item_variants enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifiers enable row level security;
alter table public.item_modifier_groups enable row level security;
alter table public.item_outlet_overrides enable row level security;

-- Read: everyone at the business.
create policy "members read categories" on public.categories
  for select to authenticated using (private.is_org_member(org_id));
create policy "members read items" on public.items
  for select to authenticated using (private.is_org_member(org_id));
create policy "members read sizes" on public.item_variants
  for select to authenticated using (private.is_org_member(org_id));
create policy "members read add-on groups" on public.modifier_groups
  for select to authenticated using (private.is_org_member(org_id));
create policy "members read add-ons" on public.modifiers
  for select to authenticated using (private.is_org_member(org_id));
create policy "members read item add-on links" on public.item_modifier_groups
  for select to authenticated using (private.is_org_member(org_id));
create policy "members read outlet prices" on public.item_outlet_overrides
  for select to authenticated using (private.is_org_member(org_id));

-- Write the menu: owners. (Items and categories are switched off, not deleted.)
create policy "owners add categories" on public.categories
  for insert to authenticated with check (private.has_org_role(org_id, '{owner}'));
create policy "owners edit categories" on public.categories
  for update to authenticated
  using (private.has_org_role(org_id, '{owner}')) with check (private.has_org_role(org_id, '{owner}'));

create policy "owners add add-on groups" on public.modifier_groups
  for insert to authenticated with check (private.has_org_role(org_id, '{owner}'));
create policy "owners edit add-on groups" on public.modifier_groups
  for update to authenticated
  using (private.has_org_role(org_id, '{owner}')) with check (private.has_org_role(org_id, '{owner}'));
create policy "owners remove add-on groups" on public.modifier_groups
  for delete to authenticated using (private.has_org_role(org_id, '{owner}'));

-- Items, sizes, add-ons and their links are written by save_item / save_modifier_group below,
-- so a save is all-or-nothing.

-- Outlet prices and availability: owners anywhere, managers at their own outlets.
create policy "managers set outlet prices and availability" on public.item_outlet_overrides
  for insert to authenticated
  with check (private.has_org_role(org_id, '{owner,manager}') and private.can_access_outlet(outlet_id));
create policy "managers change outlet prices and availability" on public.item_outlet_overrides
  for update to authenticated
  using (private.has_org_role(org_id, '{owner,manager}') and private.can_access_outlet(outlet_id))
  with check (private.has_org_role(org_id, '{owner,manager}') and private.can_access_outlet(outlet_id));
create policy "managers clear outlet prices" on public.item_outlet_overrides
  for delete to authenticated
  using (private.has_org_role(org_id, '{owner,manager}') and private.can_access_outlet(outlet_id));

-- ---------------------------------------------------------------------------------------------
-- Saves (owners): one call per item or add-on group, all-or-nothing.
-- ---------------------------------------------------------------------------------------------

-- p: { id?, orgId, categoryId, name, code, food, pricePaise, taxRateBp, description?, isActive,
--      variants: [{ name, pricePaise }], modifierGroupIds: [uuid] }
create function public.save_item(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (p ->> 'orgId')::uuid;
  v_id uuid := coalesce((p ->> 'id')::uuid, gen_random_uuid());
  v_variant jsonb;
  v_group text;
  v_i int := 0;
begin
  if not private.has_org_role(v_org, '{owner}') then
    raise exception 'Only the owner can change the menu.' using errcode = '42501';
  end if;
  if (p ->> 'id') is not null
     and not exists (select 1 from public.items where id = v_id and org_id = v_org) then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;

  insert into public.items as i
    (id, org_id, category_id, name, code, food, price_paise, tax_rate_bp, description, is_active)
  values (
    v_id, v_org, (p ->> 'categoryId')::uuid, trim(p ->> 'name'), upper(trim(p ->> 'code')),
    (p ->> 'food')::public.food_type, (p ->> 'pricePaise')::bigint, (p ->> 'taxRateBp')::int,
    nullif(trim(p ->> 'description'), ''), coalesce((p ->> 'isActive')::boolean, true)
  )
  on conflict (id) do update set
    category_id = excluded.category_id, name = excluded.name, code = excluded.code,
    food = excluded.food, price_paise = excluded.price_paise, tax_rate_bp = excluded.tax_rate_bp,
    description = excluded.description, is_active = excluded.is_active;

  -- Sizes: keep ones whose name stays (their outlet prices too), replace the rest.
  delete from public.item_variants
  where item_id = v_id
    and name not in (select trim(v ->> 'name') from jsonb_array_elements(coalesce(p -> 'variants', '[]')) v);
  for v_variant in select * from jsonb_array_elements(coalesce(p -> 'variants', '[]')) loop
    insert into public.item_variants (org_id, item_id, name, price_paise, sort)
    values (v_org, v_id, trim(v_variant ->> 'name'), (v_variant ->> 'pricePaise')::bigint, v_i)
    on conflict (item_id, name) do update set price_paise = excluded.price_paise, sort = excluded.sort;
    v_i := v_i + 1;
  end loop;

  delete from public.item_modifier_groups where item_id = v_id;
  v_i := 0;
  for v_group in select * from jsonb_array_elements_text(coalesce(p -> 'modifierGroupIds', '[]')) loop
    insert into public.item_modifier_groups (org_id, item_id, group_id, sort)
    values (v_org, v_id, v_group::uuid, v_i);
    v_i := v_i + 1;
  end loop;

  return v_id;
end;
$$;

-- p: { id?, orgId, name, options: [{ name, pricePaise }] }
create function public.save_modifier_group(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (p ->> 'orgId')::uuid;
  v_id uuid := coalesce((p ->> 'id')::uuid, gen_random_uuid());
  v_option jsonb;
  v_i int := 0;
begin
  if not private.has_org_role(v_org, '{owner}') then
    raise exception 'Only the owner can change the menu.' using errcode = '42501';
  end if;
  if (p ->> 'id') is not null
     and not exists (select 1 from public.modifier_groups where id = v_id and org_id = v_org) then
    raise exception 'Add-on group not found.' using errcode = 'P0002';
  end if;

  insert into public.modifier_groups (id, org_id, name)
  values (v_id, v_org, trim(p ->> 'name'))
  on conflict (id) do update set name = excluded.name;

  delete from public.modifiers
  where group_id = v_id
    and name not in (select trim(o ->> 'name') from jsonb_array_elements(coalesce(p -> 'options', '[]')) o);
  for v_option in select * from jsonb_array_elements(coalesce(p -> 'options', '[]')) loop
    insert into public.modifiers (org_id, group_id, name, price_paise, sort)
    values (v_org, v_id, trim(v_option ->> 'name'), (v_option ->> 'pricePaise')::bigint, v_i)
    on conflict (group_id, name) do update set price_paise = excluded.price_paise, sort = excluded.sort;
    v_i := v_i + 1;
  end loop;

  return v_id;
end;
$$;

grant execute on function public.save_item, public.save_modifier_group to authenticated;
