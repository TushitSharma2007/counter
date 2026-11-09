// Demo menu for the billing screen until menu management (CLAUDE.md §5 item 2) loads the real one
// from the database. Prices are integer paise, tax-inclusive, 5% GST (restaurant service).
import type { FoodType } from '@repo/ui';
import type { Modifier } from '@repo/pos-core';

export interface Category {
  id: string;
  name: string;
}

export interface Variant {
  id: string;
  name: string;
  pricePaise: number;
}

export interface MenuItem {
  id: string;
  /** Short code for keyboard billing on a PC: type it in search and press Enter. */
  code: string;
  name: string;
  categoryId: string;
  food: FoodType;
  pricePaise: number;
  taxRateBp: number;
  variants?: Variant[];
  modifierGroups?: string[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  options: Modifier[];
}

export const CATEGORIES: Category[] = [
  { id: 'hot', name: 'Hot Coffee' },
  { id: 'cold', name: 'Cold Coffee' },
  { id: 'tea', name: 'Tea' },
  { id: 'shakes', name: 'Shakes' },
  { id: 'snacks', name: 'Snacks' },
  { id: 'desserts', name: 'Desserts' },
];

export const MODIFIER_GROUPS: Record<string, ModifierGroup> = {
  milk: {
    id: 'milk',
    name: 'Milk',
    options: [
      { id: 'oat', name: 'Oat milk', pricePaise: 5_000 },
      { id: 'almond', name: 'Almond milk', pricePaise: 5_000 },
    ],
  },
  extras: {
    id: 'extras',
    name: 'Extras',
    options: [
      { id: 'shot', name: 'Extra shot', pricePaise: 4_000 },
      { id: 'hazelnut', name: 'Hazelnut syrup', pricePaise: 3_000 },
      { id: 'cream', name: 'Whipped cream', pricePaise: 3_000 },
    ],
  },
};

const size = (regular: number, large: number): Variant[] => [
  { id: 'R', name: 'Regular', pricePaise: regular },
  { id: 'L', name: 'Large', pricePaise: large },
];

const coffee = ['milk', 'extras'];
const gst = 500;

export const ITEMS: MenuItem[] = [
  {
    id: 'esp',
    code: 'ESP',
    name: 'Espresso',
    categoryId: 'hot',
    food: 'veg',
    pricePaise: 9_900,
    taxRateBp: gst,
    modifierGroups: ['extras'],
  },
  {
    id: 'ame',
    code: 'AME',
    name: 'Americano',
    categoryId: 'hot',
    food: 'veg',
    pricePaise: 12_900,
    taxRateBp: gst,
    modifierGroups: ['extras'],
  },
  {
    id: 'cap',
    code: 'CAP',
    name: 'Cappuccino',
    categoryId: 'hot',
    food: 'veg',
    pricePaise: 14_900,
    taxRateBp: gst,
    variants: size(14_900, 18_900),
    modifierGroups: coffee,
  },
  {
    id: 'lat',
    code: 'LAT',
    name: 'Café Latte',
    categoryId: 'hot',
    food: 'veg',
    pricePaise: 15_900,
    taxRateBp: gst,
    variants: size(15_900, 19_900),
    modifierGroups: coffee,
  },
  {
    id: 'hzl',
    code: 'HZL',
    name: 'Hazelnut Latte',
    categoryId: 'hot',
    food: 'veg',
    pricePaise: 17_900,
    taxRateBp: gst,
    variants: size(17_900, 21_900),
    modifierGroups: coffee,
  },
  {
    id: 'moc',
    code: 'MOC',
    name: 'Mocha',
    categoryId: 'hot',
    food: 'veg',
    pricePaise: 18_900,
    taxRateBp: gst,
    variants: size(18_900, 22_900),
    modifierGroups: coffee,
  },
  {
    id: 'flt',
    code: 'FLT',
    name: 'Filter Coffee',
    categoryId: 'hot',
    food: 'veg',
    pricePaise: 7_900,
    taxRateBp: gst,
  },

  {
    id: 'cc',
    code: 'CC',
    name: 'Cold Coffee',
    categoryId: 'cold',
    food: 'veg',
    pricePaise: 14_900,
    taxRateBp: gst,
    variants: size(14_900, 18_900),
    modifierGroups: coffee,
  },
  {
    id: 'iam',
    code: 'IAM',
    name: 'Iced Americano',
    categoryId: 'cold',
    food: 'veg',
    pricePaise: 14_900,
    taxRateBp: gst,
    modifierGroups: ['extras'],
  },
  {
    id: 'imo',
    code: 'IMO',
    name: 'Iced Mocha',
    categoryId: 'cold',
    food: 'veg',
    pricePaise: 18_900,
    taxRateBp: gst,
    modifierGroups: coffee,
  },
  {
    id: 'cbr',
    code: 'CBR',
    name: 'Cold Brew',
    categoryId: 'cold',
    food: 'veg',
    pricePaise: 19_900,
    taxRateBp: gst,
  },
  {
    id: 'fhz',
    code: 'FHZ',
    name: 'Hazelnut Frappé',
    categoryId: 'cold',
    food: 'veg',
    pricePaise: 21_900,
    taxRateBp: gst,
    modifierGroups: coffee,
  },

  {
    id: 'cha',
    code: 'CHA',
    name: 'Masala Chai',
    categoryId: 'tea',
    food: 'veg',
    pricePaise: 4_900,
    taxRateBp: gst,
  },
  {
    id: 'gch',
    code: 'GCH',
    name: 'Ginger Chai',
    categoryId: 'tea',
    food: 'veg',
    pricePaise: 4_900,
    taxRateBp: gst,
  },
  {
    id: 'lit',
    code: 'LIT',
    name: 'Lemon Iced Tea',
    categoryId: 'tea',
    food: 'veg',
    pricePaise: 9_900,
    taxRateBp: gst,
  },
  {
    id: 'grt',
    code: 'GRT',
    name: 'Green Tea',
    categoryId: 'tea',
    food: 'veg',
    pricePaise: 8_900,
    taxRateBp: gst,
  },

  {
    id: 'ors',
    code: 'ORS',
    name: 'Oreo Shake',
    categoryId: 'shakes',
    food: 'veg',
    pricePaise: 17_900,
    taxRateBp: gst,
  },
  {
    id: 'chs',
    code: 'CHS',
    name: 'Chocolate Shake',
    categoryId: 'shakes',
    food: 'veg',
    pricePaise: 16_900,
    taxRateBp: gst,
  },
  {
    id: 'mgs',
    code: 'MGS',
    name: 'Mango Shake',
    categoryId: 'shakes',
    food: 'veg',
    pricePaise: 15_900,
    taxRateBp: gst,
  },

  {
    id: 'vpf',
    code: 'VPF',
    name: 'Veg Puff',
    categoryId: 'snacks',
    food: 'veg',
    pricePaise: 3_900,
    taxRateBp: gst,
  },
  {
    id: 'ppf',
    code: 'PPF',
    name: 'Paneer Puff',
    categoryId: 'snacks',
    food: 'veg',
    pricePaise: 4_900,
    taxRateBp: gst,
  },
  {
    id: 'epf',
    code: 'EPF',
    name: 'Egg Puff',
    categoryId: 'snacks',
    food: 'egg',
    pricePaise: 4_500,
    taxRateBp: gst,
  },
  {
    id: 'cpf',
    code: 'CPF',
    name: 'Chicken Puff',
    categoryId: 'snacks',
    food: 'nonveg',
    pricePaise: 5_900,
    taxRateBp: gst,
  },
  {
    id: 'psw',
    code: 'PSW',
    name: 'Paneer Sandwich',
    categoryId: 'snacks',
    food: 'veg',
    pricePaise: 11_900,
    taxRateBp: gst,
  },
  {
    id: 'csw',
    code: 'CSW',
    name: 'Chicken Sandwich',
    categoryId: 'snacks',
    food: 'nonveg',
    pricePaise: 14_900,
    taxRateBp: gst,
  },
  {
    id: 'fri',
    code: 'FRI',
    name: 'Masala Fries',
    categoryId: 'snacks',
    food: 'veg',
    pricePaise: 9_900,
    taxRateBp: gst,
  },
  {
    id: 'gbr',
    code: 'GBR',
    name: 'Garlic Bread',
    categoryId: 'snacks',
    food: 'veg',
    pricePaise: 10_900,
    taxRateBp: gst,
  },

  {
    id: 'lav',
    code: 'LAV',
    name: 'Choco Lava Cake',
    categoryId: 'desserts',
    food: 'egg',
    pricePaise: 12_900,
    taxRateBp: gst,
  },
  {
    id: 'brw',
    code: 'BRW',
    name: 'Walnut Brownie',
    categoryId: 'desserts',
    food: 'egg',
    pricePaise: 9_900,
    taxRateBp: gst,
  },
  {
    id: 'chk',
    code: 'CHK',
    name: 'Blueberry Cheesecake',
    categoryId: 'desserts',
    food: 'egg',
    pricePaise: 17_900,
    taxRateBp: gst,
  },
];

/** A tap must ask which size; otherwise it adds straight to the bill. */
export function needsSize(item: MenuItem): boolean {
  return (item.variants?.length ?? 0) > 0;
}

/** Has sizes or add-ons to choose from (long-press to open them). */
export function hasOptions(item: MenuItem): boolean {
  return needsSize(item) || (item.modifierGroups?.length ?? 0) > 0;
}

/** Search by name or short code; an exact code match comes first. */
export function searchItems(query: string): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact = ITEMS.filter((item) => item.code.toLowerCase() === q);
  const rest = ITEMS.filter(
    (item) =>
      !exact.includes(item) &&
      (item.name.toLowerCase().includes(q) || item.code.toLowerCase().startsWith(q)),
  );
  return [...exact, ...rest];
}
