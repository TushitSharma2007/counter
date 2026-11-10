// A paid bill as it leaves the counter: numbered on the device, queued, then synced
// (CLAUDE.md §7). Pure: ids, time and the bill counter are passed in.
import type { BillTotals, TaxSettings } from './bill.ts';
import type { Cart, PaymentMode } from './cart.ts';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Web Crypto is global in browsers, Deno and Node; this package has no DOM types, so type just what we use.
const webCrypto = (
  globalThis as unknown as { crypto: { getRandomValues(a: Uint8Array): Uint8Array } }
).crypto;

/** UUIDv7: time-ordered, made on the device so offline bills keep stable ids. */
export function uuidv7(
  nowMs = Date.now(),
  random: Uint8Array = webCrypto.getRandomValues(new Uint8Array(10)),
): string {
  const hex = nowMs.toString(16).padStart(12, '0').slice(-12);
  const r = [...random].map((b) => b.toString(16).padStart(2, '0')).join('');
  const variant = ((parseInt(r.slice(4, 6), 16) & 0x3f) | 0x80).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${r.slice(1, 4)}-${variant}${r.slice(6, 8)}-${r.slice(8, 20)}`;
}

function ist(iso: string): Date {
  return new Date(Date.parse(iso) + IST_OFFSET_MS);
}

/** Indian financial year (1 April – 31 March) as four digits: 2026-27 → "2627". */
export function financialYear(iso: string): string {
  const d = ist(iso);
  const year = d.getUTCFullYear() % 100;
  const start = d.getUTCMonth() >= 3 ? year : year - 1;
  const pad = (n: number) => String((n + 100) % 100).padStart(2, '0');
  return `${pad(start)}${pad(start + 1)}`;
}

/** The business day a sale belongs to: before the day-close hour, it's still yesterday. */
export function businessDate(iso: string, dayCloseHour = 4): string {
  const d = new Date(ist(iso).getTime() - dayCloseHour * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** ARC-T1/2627/000012: outlet, device, financial year, running number on that device. */
export function formatBillNumber(
  outletCode: string,
  deviceCode: string,
  fy: string,
  seq: number,
): string {
  return `${outletCode}-${deviceCode}/${fy}/${String(seq).padStart(6, '0')}`;
}

export interface OrderLine {
  id: string;
  itemId: string;
  name: string;
  variantName: string | null;
  modifiers: { id: string; name: string; pricePaise: number }[];
  unitPaise: number;
  qty: number;
  taxRateBp: number;
  lineTotalPaise: number;
}

export interface OrderPayment {
  id: string;
  mode: Exclude<PaymentMode, 'split'>;
  amountPaise: number;
  /** Cash handed over, when it was more than the bill. */
  tenderedPaise: number | null;
}

export interface OrderPayload {
  id: string;
  deviceId: string;
  outletId: string;
  financialYear: string;
  billSeq: number;
  billNumber: string;
  businessDate: string;
  createdAt: string;
  orderType: Cart['orderType'];
  customerPhone: string | null;
  /** Who billed it: a PIN-signed-in member at a counter tablet, or the owner on their phone. */
  billedBy: { membershipId: string | null; name: string };
  tax: TaxSettings;
  totals: Omit<BillTotals, 'taxGroups'>;
  lines: OrderLine[];
  payments: OrderPayment[];
}

/** How part (or all) of a bill was paid. Cash may be more than the part, when change was given. */
export interface PaymentPart {
  mode: OrderPayment['mode'];
  amountPaise: number;
  tenderedPaise?: number;
}

export interface BuildOrderInput {
  cart: Cart;
  totals: BillTotals;
  tax: TaxSettings;
  /** One part for a normal bill, several for a split (e.g. ₹200 cash + ₹156 UPI). Must add up to the total. */
  payments: PaymentPart[];
  device: { id: string; code: string };
  outlet: { id: string; code: string };
  billedBy: OrderPayload['billedBy'];
  /** The next number in this device's series for this financial year. */
  seq: number;
  now: string;
  dayCloseHour?: number;
  newId?: () => string;
}

export function buildOrder(input: BuildOrderInput): OrderPayload {
  const paid = input.payments.reduce((sum, p) => sum + p.amountPaise, 0);
  if (
    input.payments.length === 0 ||
    paid !== input.totals.totalPaise ||
    input.payments.some((p) => p.amountPaise <= 0)
  ) {
    throw new RangeError(`Payments (${paid}) must add up to the bill (${input.totals.totalPaise})`);
  }
  const newId = input.newId ?? (() => uuidv7());
  const fy = financialYear(input.now);
  return {
    id: newId(),
    deviceId: input.device.id,
    outletId: input.outlet.id,
    financialYear: fy,
    billSeq: input.seq,
    billNumber: formatBillNumber(input.outlet.code, input.device.code, fy, input.seq),
    businessDate: businessDate(input.now, input.dayCloseHour),
    createdAt: input.now,
    orderType: input.cart.orderType,
    customerPhone: input.cart.customerPhone.length === 10 ? input.cart.customerPhone : null,
    billedBy: input.billedBy,
    tax: input.tax,
    totals: {
      itemTotalPaise: input.totals.itemTotalPaise,
      taxablePaise: input.totals.taxablePaise,
      cgstPaise: input.totals.cgstPaise,
      sgstPaise: input.totals.sgstPaise,
      roundOffPaise: input.totals.roundOffPaise,
      totalPaise: input.totals.totalPaise,
    },
    lines: input.cart.lines.map((l) => ({
      id: newId(),
      itemId: l.itemId,
      name: l.name,
      variantName: l.variant?.name ?? null,
      modifiers: l.modifiers.map((m) => ({ id: m.id, name: m.name, pricePaise: m.pricePaise })),
      unitPaise: l.unitPaise,
      qty: l.qty,
      taxRateBp: l.taxRateBp,
      lineTotalPaise: l.unitPaise * l.qty,
    })),
    payments: input.payments.map((p) => ({
      id: newId(),
      mode: p.mode,
      amountPaise: p.amountPaise,
      tenderedPaise:
        p.tenderedPaise !== undefined && p.tenderedPaise > p.amountPaise ? p.tenderedPaise : null,
    })),
  };
}
