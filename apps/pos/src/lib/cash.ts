import { formatINR } from '@repo/ui';

/** "₹49 short", "₹10 over", "Matches". */
export function differenceText(paise: number): string {
  if (paise === 0) return 'Matches';
  return `${formatINR(Math.abs(paise))} ${paise < 0 ? 'short' : 'over'}`;
}

/** Common reasons, one tap at a busy counter. Anything else is typed. */
export const CASH_REASONS = {
  out: ['Milk & supplies', 'Vendor payment', 'Owner took cash', 'Staff advance'],
  in: ['Change from bank', 'Owner added cash'],
} as const;
