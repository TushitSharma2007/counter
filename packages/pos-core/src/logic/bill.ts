// Bill totals and GST (CLAUDE.md §7, §11). Integer paise in, integer paise out.

export interface TaxSettings {
  /** 'regular': tax invoice with CGST/SGST. 'composition': bill of supply, no tax charged. */
  gstScheme: 'regular' | 'composition';
  /** Menu prices already include GST (the default for cafés). */
  pricesIncludeTax: boolean;
  /** Work out tax on each line and add up, or on each rate's total once. */
  rounding: 'line' | 'bill';
}

export const DEFAULT_TAX: TaxSettings = {
  gstScheme: 'regular',
  pricesIncludeTax: true,
  rounding: 'bill',
};

export interface BillLineInput {
  /** Price of one unit as listed on the menu, including modifiers. */
  unitPaise: number;
  qty: number;
  /** GST rate in basis points: 500 = 5%. */
  taxRateBp: number;
}

export interface TaxGroup {
  rateBp: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
}

export interface BillTotals {
  /** Sum of line amounts at menu prices. */
  itemTotalPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  taxGroups: TaxGroup[];
  /** Added to reach a whole rupee; between -50 and +49 paise. */
  roundOffPaise: number;
  totalPaise: number;
}

function assertPaise(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${what} must be whole paise, got ${value}`);
  }
}

/** Tax contained in an amount that already includes it. */
function taxInside(amount: number, rateBp: number): number {
  return amount - Math.round((amount * 10_000) / (10_000 + rateBp));
}

/** Tax to add on top of an amount. */
function taxOnTop(amount: number, rateBp: number): number {
  return Math.round((amount * rateBp) / 10_000);
}

export function computeBill(
  lines: BillLineInput[],
  settings: TaxSettings = DEFAULT_TAX,
): BillTotals {
  const byRate = new Map<number, { amount: number; tax: number }>();

  for (const line of lines) {
    assertPaise(line.unitPaise, 'unitPaise');
    if (!Number.isSafeInteger(line.qty) || line.qty <= 0) {
      throw new RangeError('qty must be a positive whole number');
    }
    const amount = line.unitPaise * line.qty;
    const rate = settings.gstScheme === 'composition' ? 0 : line.taxRateBp;
    const group = byRate.get(rate) ?? { amount: 0, tax: 0 };
    group.amount += amount;
    if (settings.rounding === 'line') {
      group.tax += settings.pricesIncludeTax ? taxInside(amount, rate) : taxOnTop(amount, rate);
    }
    byRate.set(rate, group);
  }

  const taxGroups: TaxGroup[] = [];
  let itemTotalPaise = 0;
  let taxPaise = 0;

  for (const [rateBp, group] of [...byRate].sort(([a], [b]) => a - b)) {
    let tax = group.tax;
    if (settings.rounding === 'bill') {
      tax = settings.pricesIncludeTax
        ? taxInside(group.amount, rateBp)
        : taxOnTop(group.amount, rateBp);
    }
    itemTotalPaise += group.amount;
    taxPaise += tax;
    if (rateBp > 0) {
      // Split evenly; an odd paisa goes to CGST.
      const sgst = Math.floor(tax / 2);
      taxGroups.push({
        rateBp,
        taxablePaise: settings.pricesIncludeTax ? group.amount - tax : group.amount,
        cgstPaise: tax - sgst,
        sgstPaise: sgst,
      });
    }
  }

  const beforeRound = settings.pricesIncludeTax ? itemTotalPaise : itemTotalPaise + taxPaise;
  const totalPaise = Math.round(beforeRound / 100) * 100;

  return {
    itemTotalPaise,
    taxablePaise: settings.pricesIncludeTax ? itemTotalPaise - taxPaise : itemTotalPaise,
    cgstPaise: taxGroups.reduce((sum, g) => sum + g.cgstPaise, 0),
    sgstPaise: taxGroups.reduce((sum, g) => sum + g.sgstPaise, 0),
    taxGroups,
    roundOffPaise: totalPaise - beforeRound,
    totalPaise,
  };
}

/** Change to hand back for a cash payment; negative means the customer still owes that much. */
export function cashChange(totalPaise: number, tenderedPaise: number): number {
  assertPaise(totalPaise, 'totalPaise');
  assertPaise(tenderedPaise, 'tenderedPaise');
  return tenderedPaise - totalPaise;
}
