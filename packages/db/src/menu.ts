// The menu as billing and the menu editor see it, with each outlet's own prices and availability.
import type { Db } from './client.ts';
import { ItemInput, ModifierGroupInput } from './contracts/menu.ts';

export type FoodType = 'veg' | 'nonveg' | 'egg';

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  isActive: boolean;
}

export interface MenuVariant {
  id: string;
  name: string;
  /** At this outlet (its own price, if it has one). */
  pricePaise: number;
  basePricePaise: number;
  available: boolean;
}

export interface MenuModifier {
  id: string;
  name: string;
  pricePaise: number;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  options: MenuModifier[];
}

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  food: FoodType;
  /** At this outlet (its own price, if it has one). */
  pricePaise: number;
  basePricePaise: number;
  taxRateBp: number;
  description: string | null;
  isActive: boolean;
  /** At this outlet. False = sold out here. */
  available: boolean;
  variants: MenuVariant[];
  modifierGroupIds: string[];
}

/** What a bill and its receipt need about the outlet and the business. */
export interface BillingContext {
  outlet: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    upiVpa: string | null;
  };
  org: {
    name: string;
    gstin: string | null;
    gstScheme: 'regular' | 'composition';
    pricesIncludeTax: boolean;
    dayCloseHour: number;
  };
}

export interface Menu {
  orgId: string;
  categories: MenuCategory[];
  items: MenuItem[];
  modifierGroups: Record<string, MenuModifierGroup>;
  /** With an outlet: its details and the business's tax settings, cached with the menu for offline. */
  billing?: BillingContext;
}

export interface OutletOverride {
  itemId: string;
  variantId: string | null;
  pricePaise: number | null;
  isAvailable: boolean;
}

const LIMIT = 1_000;

/**
 * The menu of an org. With an outlet, prices and availability are that outlet's.
 * `includeInactive` is for the editor; billing only sees items that are switched on.
 */
export async function fetchMenu(
  db: Db,
  {
    outletId,
    orgId: givenOrg,
    includeInactive = false,
  }: { outletId?: string; orgId?: string; includeInactive?: boolean },
): Promise<Menu> {
  let orgId = givenOrg;
  let billing: BillingContext | undefined;
  if (outletId) {
    const found = await fetchBillingContextWithOrg(db, outletId);
    billing = found.billing;
    orgId ??= found.orgId;
  }
  if (!orgId) throw new Error('fetchMenu needs an outlet or an org');

  const itemsQuery = db
    .from('items')
    .select(
      'id, category_id, name, code, food, price_paise, tax_rate_bp, description, sort, is_active, item_variants (id, name, price_paise, sort), item_modifier_groups (group_id, sort)',
    )
    .eq('org_id', orgId)
    .order('sort')
    .limit(LIMIT);
  const categoriesQuery = db
    .from('categories')
    .select('id, name, sort, is_active')
    .eq('org_id', orgId)
    .order('sort')
    .limit(LIMIT);

  const [categories, items, groups, overrides] = await Promise.all([
    includeInactive ? categoriesQuery : categoriesQuery.eq('is_active', true),
    includeInactive ? itemsQuery : itemsQuery.eq('is_active', true),
    db
      .from('modifier_groups')
      .select('id, name, sort, modifiers (id, name, price_paise, sort, is_active)')
      .eq('org_id', orgId)
      .order('sort')
      .limit(LIMIT),
    outletId
      ? db
          .from('item_outlet_overrides')
          .select('item_id, variant_id, price_paise, is_available')
          .eq('outlet_id', outletId)
          .limit(LIMIT * 4)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [categories, items, groups, overrides]) if (result.error) throw result.error;

  const override = (itemId: string, variantId: string | null) =>
    overrides.data?.find((o) => o.item_id === itemId && o.variant_id === variantId);

  return {
    orgId,
    ...(billing ? { billing } : {}),
    categories: (categories.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      sort: c.sort,
      isActive: c.is_active,
    })),
    items: (items.data ?? []).map((i) => {
      const own = override(i.id, null);
      return {
        id: i.id,
        code: i.code,
        name: i.name,
        categoryId: i.category_id,
        food: i.food,
        pricePaise: own?.price_paise ?? i.price_paise,
        basePricePaise: i.price_paise,
        taxRateBp: i.tax_rate_bp,
        description: i.description,
        isActive: i.is_active,
        available: own?.is_available ?? true,
        variants: [...i.item_variants]
          .sort((a, b) => a.sort - b.sort)
          .map((v) => {
            const vo = override(i.id, v.id);
            return {
              id: v.id,
              name: v.name,
              pricePaise: vo?.price_paise ?? v.price_paise,
              basePricePaise: v.price_paise,
              available: (own?.is_available ?? true) && (vo?.is_available ?? true),
            };
          }),
        modifierGroupIds: [...i.item_modifier_groups]
          .sort((a, b) => a.sort - b.sort)
          .map((g) => g.group_id),
      };
    }),
    modifierGroups: Object.fromEntries(
      (groups.data ?? []).map((g) => [
        g.id,
        {
          id: g.id,
          name: g.name,
          options: [...g.modifiers]
            .filter((m) => m.is_active)
            .sort((a, b) => a.sort - b.sort)
            .map((m) => ({ id: m.id, name: m.name, pricePaise: m.price_paise })),
        },
      ]),
    ),
  };
}

export async function fetchOutletOverrides(db: Db, outletId: string): Promise<OutletOverride[]> {
  const { data, error } = await db
    .from('item_outlet_overrides')
    .select('item_id, variant_id, price_paise, is_available')
    .eq('outlet_id', outletId)
    .limit(LIMIT * 4);
  if (error) throw error;
  return data.map((o) => ({
    itemId: o.item_id,
    variantId: o.variant_id,
    pricePaise: o.price_paise,
    isAvailable: o.is_available,
  }));
}

export async function saveItem(db: Db, input: ItemInput): Promise<string> {
  const item = ItemInput.parse(input);
  const { data, error } = await db.rpc('save_item', { p: item });
  if (error) throw error;
  return data;
}

export async function saveModifierGroup(db: Db, input: ModifierGroupInput): Promise<string> {
  const group = ModifierGroupInput.parse(input);
  const { data, error } = await db.rpc('save_modifier_group', { p: group });
  if (error) throw error;
  return data;
}

export async function saveCategory(
  db: Db,
  category: { id?: string; orgId: string; name: string; sort: number; isActive?: boolean },
): Promise<void> {
  const row = {
    org_id: category.orgId,
    name: category.name.trim(),
    sort: category.sort,
    is_active: category.isActive ?? true,
  };
  const { error } = category.id
    ? await db.from('categories').update(row).eq('id', category.id)
    : await db.from('categories').insert(row);
  if (error) throw error;
}

/**
 * An outlet's own price and availability for an item (or one of its sizes).
 * Back to menu price and available = the override row is removed.
 */
export async function setOutletOverride(
  db: Db,
  o: {
    orgId: string;
    outletId: string;
    itemId: string;
    variantId?: string | null;
    pricePaise: number | null;
    isAvailable: boolean;
  },
): Promise<void> {
  const variantId = o.variantId ?? null;
  if (o.pricePaise === null && o.isAvailable) {
    let query = db
      .from('item_outlet_overrides')
      .delete()
      .eq('outlet_id', o.outletId)
      .eq('item_id', o.itemId);
    query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
    const { error } = await query;
    if (error) throw error;
    return;
  }
  const { error } = await db.from('item_outlet_overrides').upsert(
    {
      org_id: o.orgId,
      outlet_id: o.outletId,
      item_id: o.itemId,
      variant_id: variantId,
      price_paise: o.pricePaise,
      is_available: o.isAvailable,
    },
    { onConflict: 'outlet_id,item_id,variant_id' },
  );
  if (error) throw error;
}

/** Every outlet's own price and availability for one item (for the item editor). */
export async function fetchItemOverrides(
  db: Db,
  itemId: string,
): Promise<(OutletOverride & { outletId: string })[]> {
  const { data, error } = await db
    .from('item_outlet_overrides')
    .select('outlet_id, item_id, variant_id, price_paise, is_available')
    .eq('item_id', itemId)
    .limit(LIMIT);
  if (error) throw error;
  return data.map((o) => ({
    outletId: o.outlet_id,
    itemId: o.item_id,
    variantId: o.variant_id,
    pricePaise: o.price_paise,
    isAvailable: o.is_available,
  }));
}

/** The sizes of one item, by name (after a save, to set outlet prices for new sizes). */
export async function fetchItemVariants(
  db: Db,
  itemId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db
    .from('item_variants')
    .select('id, name')
    .eq('item_id', itemId)
    .limit(50);
  if (error) throw error;
  return data;
}

async function fetchBillingContextWithOrg(
  db: Db,
  outletId: string,
): Promise<{ orgId: string; billing: BillingContext }> {
  const { data, error } = await db
    .from('outlets')
    .select(
      'id, org_id, name, code, address, city, upi_vpa, orgs (name, gstin, gst_scheme, prices_include_tax, day_close_hour)',
    )
    .eq('id', outletId)
    .single();
  if (error) throw error;
  const billing: BillingContext = {
    outlet: {
      id: data.id,
      name: data.name,
      code: data.code,
      address: data.address,
      city: data.city,
      upiVpa: data.upi_vpa,
    },
    org: {
      name: data.orgs.name,
      gstin: data.orgs.gstin,
      gstScheme: data.orgs.gst_scheme === 'composition' ? 'composition' : 'regular',
      pricesIncludeTax: data.orgs.prices_include_tax,
      dayCloseHour: data.orgs.day_close_hour,
    },
  };
  return { orgId: data.org_id, billing };
}

/** What a receipt needs about the outlet and the business. */
export async function fetchBillingContext(db: Db, outletId: string): Promise<BillingContext> {
  return (await fetchBillingContextWithOrg(db, outletId)).billing;
}
