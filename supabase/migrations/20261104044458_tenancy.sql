-- Tenancy: orgs (tenants), outlets (branches), staff profiles and memberships (CLAUDE.md §4).
-- Every tenant-owned row is scoped by org_id and protected by RLS through the helpers below.

create type public.app_role as enum ('owner', 'manager', 'cashier', 'kitchen', 'loyalty_staff');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  plan text not null default 'free',
  -- Keep in sync with MODULES in packages/config/src/flags.ts.
  modules text[] not null default array['pos']
    check (modules <@ array['pos', 'kds', 'inventory', 'loyalty', 'multi_outlet']),
  -- 'regular' prints a tax invoice with CGST/SGST lines; 'composition' a bill of supply.
  gst_scheme text not null default 'regular' check (gst_scheme in ('regular', 'composition')),
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  prices_include_tax boolean not null default true,
  -- A business day ends at this local hour (e.g. 4 = sales until 4 am count for the day before).
  day_close_hour smallint not null default 4 check (day_close_hour between 0 and 23),
  timezone text not null default 'Asia/Kolkata',
  usage jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  -- Short code used in bill numbers, e.g. ARC in ARC-T2/2526/000123.
  code text not null check (code ~ '^[A-Z0-9]{2,6}$'),
  address text,
  city text,
  upi_vpa text check (upi_vpa ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create index outlets_org_id_idx on public.outlets (org_id);

-- Staff only. Loyalty customers live in loyalty.customers.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  phone text check (phone ~ '^\+?[0-9]{10,15}$'),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  -- Outlets this member works at. Owners see every outlet regardless.
  outlet_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index memberships_org_id_idx on public.memberships (org_id);
create index memberships_user_id_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------------------------
-- RLS helpers. In a schema the API does not expose; security definer so they can read
-- memberships without recursing through its own policies.
-- ---------------------------------------------------------------------------------------------

create schema private;
grant usage on schema private to authenticated;

create function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org
      and m.user_id = (select auth.uid())
      and m.is_active
  );
$$;

create function private.has_org_role(target_org uuid, roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role = any (roles)
  );
$$;

-- Owners reach every outlet of their org; everyone else only the outlets assigned to them.
create function private.can_access_outlet(target_outlet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.outlets o
    join public.memberships m on m.org_id = o.org_id
    where o.id = target_outlet
      and m.user_id = (select auth.uid())
      and m.is_active
      and (m.role = 'owner' or o.id = any (m.outlet_ids))
  );
$$;

-- True when the current user and target_user share an org where the current user manages staff.
create function private.manages_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid())
      and mine.is_active
      and mine.role in ('owner', 'manager')
      and theirs.user_id = target_user
  );
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Grants and policies. anon has no access to tenant data at all.
-- ---------------------------------------------------------------------------------------------

revoke all on public.orgs, public.outlets, public.profiles, public.memberships from anon;

alter table public.orgs enable row level security;
alter table public.outlets enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

-- Orgs are created by a server-side signup flow (service role), never directly by a client.
create policy "members read their org" on public.orgs
  for select to authenticated
  using (private.is_org_member(id));

create policy "owners update their org" on public.orgs
  for update to authenticated
  using (private.has_org_role(id, '{owner}'))
  with check (private.has_org_role(id, '{owner}'));

-- Outlets are deactivated, not deleted, so their bills keep a home.
create policy "members read outlets they work at" on public.outlets
  for select to authenticated
  using (private.can_access_outlet(id));

create policy "owners add outlets" on public.outlets
  for insert to authenticated
  with check (private.has_org_role(org_id, '{owner}'));

create policy "owners update outlets" on public.outlets
  for update to authenticated
  using (private.has_org_role(org_id, '{owner}'))
  with check (private.has_org_role(org_id, '{owner}'));

create policy "staff read own profile, managers read their staff" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.manages_user(id));

create policy "staff update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "staff read own memberships, managers read their org's" on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or private.has_org_role(org_id, '{owner,manager}'));

create policy "owners add members" on public.memberships
  for insert to authenticated
  with check (private.has_org_role(org_id, '{owner}'));

create policy "owners update members" on public.memberships
  for update to authenticated
  using (private.has_org_role(org_id, '{owner}'))
  with check (private.has_org_role(org_id, '{owner}'));

create policy "owners remove members" on public.memberships
  for delete to authenticated
  using (private.has_org_role(org_id, '{owner}'));

-- ---------------------------------------------------------------------------------------------
-- An org always keeps at least one active owner (an owner can't remove or demote themselves
-- into an ownerless org). Deleting the whole org cascades past this check.
-- ---------------------------------------------------------------------------------------------

create function private.keep_an_owner()
returns trigger
language plpgsql
-- Definer: the check must see the org even after RLS hides it from the member being removed.
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.orgs where id = old.org_id)
     and not exists (
       select 1 from public.memberships
       where org_id = old.org_id and role = 'owner' and is_active
     )
  then
    raise exception 'An org needs at least one active owner.' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create trigger memberships_keep_an_owner
  after update or delete on public.memberships
  for each row
  when (old.role = 'owner')
  execute function private.keep_an_owner();
