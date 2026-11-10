import { describe, expect, it } from 'vitest';
import { computeBill, DEFAULT_TAX } from './bill.ts';
import { cartReducer, EMPTY_CART } from './cart.ts';
import { buildOrder, businessDate, financialYear, formatBillNumber, uuidv7 } from './order.ts';

describe('uuidv7', () => {
  it('is a version 7 UUID with the RFC variant', () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('sorts by time', () => {
    const earlier = uuidv7(Date.parse('2026-11-10T04:00:00Z'));
    const later = uuidv7(Date.parse('2026-11-10T04:00:01Z'));
    expect(earlier < later).toBe(true);
  });
});

describe('financialYear', () => {
  it('runs April to March, in Indian time', () => {
    expect(financialYear('2026-11-10T06:00:00Z')).toBe('2627');
    expect(financialYear('2027-03-31T18:00:00Z')).toBe('2627'); // 11:30 pm IST, 31 March
    expect(financialYear('2027-03-31T18:30:00Z')).toBe('2728'); // midnight IST, 1 April
    expect(financialYear('2099-12-01T00:00:00Z')).toBe('9900');
  });
});

describe('businessDate', () => {
  it('uses Indian time, and sales before the day-close hour count for the day before', () => {
    // 10:00 pm IST on 10 Nov
    expect(businessDate('2026-11-10T16:30:00Z')).toBe('2026-11-10');
    // 1:30 am IST on 11 Nov, before the 4 am close: still the 10th
    expect(businessDate('2026-11-10T20:00:00Z', 4)).toBe('2026-11-10');
    // 5:00 am IST on 11 Nov
    expect(businessDate('2026-11-10T23:30:00Z', 4)).toBe('2026-11-11');
  });
});

describe('formatBillNumber', () => {
  it('reads outlet, device, financial year, running number', () => {
    expect(formatBillNumber('ARC', 'T1', '2627', 12)).toBe('ARC-T1/2627/000012');
  });
});

describe('buildOrder', () => {
  const cart =
    [cartReducer(EMPTY_CART, { type: 'orderType', value: 'takeaway' })].map((c) =>
      cartReducer(c, {
        type: 'add',
        line: {
          itemId: 'cc',
          name: 'Cold Coffee',
          variant: { id: 'L', name: 'Large' },
          modifiers: [{ id: 'shot', name: 'Extra shot', pricePaise: 4_000 }],
          unitPaise: 22_900,
          taxRateBp: 500,
        },
      }),
    )[0] ?? EMPTY_CART;
  const totals = computeBill(cart.lines);
  let n = 0;
  const order = buildOrder({
    cart: { ...cart, customerPhone: '98260' },
    totals,
    tax: DEFAULT_TAX,
    payment: { mode: 'cash', tenderedPaise: 50_000 },
    device: { id: 'device-1', code: 'T1' },
    outlet: { id: 'outlet-1', code: 'ARC' },
    billedBy: { membershipId: 'm-1', name: 'Priya Sharma' },
    seq: 12,
    now: '2026-11-10T06:00:00Z',
    newId: () => `id-${++n}`,
  });

  it('numbers the bill for this device and year', () => {
    expect(order.billNumber).toBe('ARC-T1/2627/000012');
    expect(order.businessDate).toBe('2026-11-10');
  });

  it('copies names and prices onto the bill, so menu changes never alter it', () => {
    expect(order.lines).toEqual([
      {
        id: 'id-2',
        itemId: 'cc',
        name: 'Cold Coffee',
        variantName: 'Large',
        modifiers: [{ id: 'shot', name: 'Extra shot', pricePaise: 4_000 }],
        unitPaise: 22_900,
        qty: 1,
        taxRateBp: 500,
        lineTotalPaise: 22_900,
      },
    ]);
  });

  it('records the payment, and the cash handed over when there was change', () => {
    expect(order.payments).toEqual([
      { id: 'id-3', mode: 'cash', amountPaise: 22_900, tenderedPaise: 50_000 },
    ]);
  });

  it('keeps a customer number only when it is a full 10 digits', () => {
    expect(order.customerPhone).toBeNull();
  });
});
