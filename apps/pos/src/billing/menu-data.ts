// The outlet's menu for billing: loaded from the database, kept on the device so billing still
// works offline (CLAUDE.md §7: menu and prices are server-authoritative and cached).
import { fetchMenu, type Menu, type MenuItem } from '@repo/db';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/db.ts';

const cacheKey = (outletId: string) => `counter.menu.${outletId}`;

function readCached(outletId: string): Menu | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(outletId));
    return raw ? (JSON.parse(raw) as Menu) : undefined;
  } catch {
    return undefined;
  }
}

export function useMenu(outletId: string) {
  return useQuery({
    queryKey: ['menu', outletId],
    queryFn: async () => {
      const menu = await fetchMenu(db, { outletId });
      localStorage.setItem(cacheKey(outletId), JSON.stringify(menu));
      return menu;
    },
    initialData: () => readCached(outletId),
    initialDataUpdatedAt: 0, // refresh the cached copy whenever we can
    staleTime: 60_000,
  });
}

/** A tap must ask which size; otherwise it adds straight to the bill. */
export function needsSize(item: MenuItem): boolean {
  return item.variants.length > 0;
}

/** Has sizes or add-ons to choose from (long-press to open them). */
export function hasOptions(item: MenuItem): boolean {
  return needsSize(item) || item.modifierGroupIds.length > 0;
}

/** The lowest price on the menu, for "from ₹149" on items with sizes. */
export function fromPrice(item: MenuItem): number {
  return item.variants.length > 0
    ? Math.min(...item.variants.map((v) => v.pricePaise))
    : item.pricePaise;
}

/** Search by name or short code; an exact code match comes first. Sold-out items come last. */
export function searchItems(items: MenuItem[], query: string): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact = items.filter((item) => item.code.toLowerCase() === q);
  const rest = items.filter(
    (item) =>
      !exact.includes(item) &&
      (item.name.toLowerCase().includes(q) || item.code.toLowerCase().startsWith(q)),
  );
  return [...exact, ...rest].sort((a, b) => Number(b.available) - Number(a.available));
}
