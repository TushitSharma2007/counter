// Money is integer paise everywhere (CLAUDE.md §7). This only formats it for display.

const formatters = new Map<number, Intl.NumberFormat>();

function formatter(fractionDigits: 0 | 2): Intl.NumberFormat {
  let f = formatters.get(fractionDigits);
  if (!f) {
    f = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(fractionDigits, f);
  }
  return f;
}

export interface FormatInrOptions {
  /** 'auto' drops ".00" on whole rupees (menus, dashboards); 'always' keeps it (bills). */
  decimals?: 'auto' | 'always';
}

/** 1234567 paise → "₹12,345.67"; lakh/crore grouping comes from the en-IN locale. */
export function formatINR(paise: number, { decimals = 'auto' }: FormatInrOptions = {}): string {
  if (!Number.isSafeInteger(paise)) throw new RangeError(`paise must be an integer, got ${paise}`);
  const whole = paise % 100 === 0;
  return formatter(decimals === 'auto' && whole ? 0 : 2).format(paise / 100);
}
