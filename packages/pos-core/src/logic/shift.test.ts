import { describe, expect, it } from 'vitest';
import {
  cashDifference,
  cashMovement,
  closeShift,
  openShift,
  summariseShift,
  type ShiftBill,
} from './shift.ts';

const priya = { membershipId: 'm-priya', name: 'Priya Sharma' };
let n = 0;
const newId = () => `id-${String(++n)}`;

const bill = (payments: ShiftBill['payments'], voided = false): ShiftBill => ({
  payments,
  totalPaise: payments.reduce((s, p) => s + p.amountPaise, 0),
  voided,
});

describe('openShift', () => {
  it('opens on the business day, so 2 am belongs to the day before', () => {
    const shift = openShift({
      deviceId: 'd1',
      openingCashPaise: 200_000,
      by: priya,
      now: '2026-11-10T20:30:00Z', // 2:00 am IST on the 11th
      newId,
    });
    expect(shift.businessDate).toBe('2026-11-10');
    expect(shift.openedByName).toBe('Priya Sharma');
  });

  it('allows an empty drawer but not a negative or fractional one', () => {
    const base = { deviceId: 'd1', by: priya, now: '2026-11-10T03:00:00Z', newId };
    expect(openShift({ ...base, openingCashPaise: 0 }).openingCashPaise).toBe(0);
    expect(() => openShift({ ...base, openingCashPaise: -100 })).toThrow(RangeError);
    expect(() => openShift({ ...base, openingCashPaise: 10.5 })).toThrow(RangeError);
  });
});

describe('cashMovement', () => {
  const base = {
    shiftId: 's1',
    kind: 'out' as const,
    by: priya,
    now: '2026-11-10T07:00:00Z',
    newId,
  };

  it('needs a reason and a positive amount', () => {
    expect(() => cashMovement({ ...base, amountPaise: 45_000, reason: '  ' })).toThrow(RangeError);
    expect(() => cashMovement({ ...base, amountPaise: 0, reason: 'Milk' })).toThrow(RangeError);
    expect(
      cashMovement({ ...base, amountPaise: 45_000, reason: ' Milk from the dairy ' }).reason,
    ).toBe('Milk from the dairy');
  });
});

describe('summariseShift', () => {
  it('expects opening + cash taken + cash in - cash out', () => {
    const s = summariseShift(
      { openingCashPaise: 200_000 },
      [
        { kind: 'out', amountPaise: 45_000 },
        { kind: 'in', amountPaise: 50_000 },
      ],
      [
        // ₹149 paid with a ₹500 note: the drawer keeps ₹149, the rest went back as change.
        bill([{ id: 'p1', mode: 'cash', amountPaise: 14_900, tenderedPaise: 50_000 }]),
        bill([{ id: 'p2', mode: 'upi', amountPaise: 14_900, tenderedPaise: null }]),
        bill([
          { id: 'p3', mode: 'cash', amountPaise: 5_000, tenderedPaise: null },
          { id: 'p4', mode: 'card', amountPaise: 3_800, tenderedPaise: null },
        ]),
      ],
    );
    expect(s).toMatchObject({
      bills: 3,
      salesPaise: 38_600,
      cashSalesPaise: 19_900,
      upiSalesPaise: 14_900,
      cardSalesPaise: 3_800,
      cashInPaise: 50_000,
      cashOutPaise: 45_000,
      expectedCashPaise: 224_900,
    });
  });

  it('leaves voided bills out of the drawer but counts them', () => {
    const s = summariseShift(
      { openingCashPaise: 0 },
      [],
      [bill([{ id: 'p1', mode: 'cash', amountPaise: 14_900, tenderedPaise: null }], true)],
    );
    expect(s).toMatchObject({ bills: 0, voids: 1, voidPaise: 14_900, expectedCashPaise: 0 });
  });
});

describe('closeShift', () => {
  it('keeps the note only when there is one', () => {
    const base = {
      shiftId: 's1',
      expectedCashPaise: 219_900,
      by: priya,
      now: '2026-11-10T16:00:00Z',
    };
    expect(closeShift({ ...base, countedCashPaise: 215_000, note: '  ' }).note).toBeNull();
    expect(
      closeShift({ ...base, countedCashPaise: 215_000, note: 'Short by a ₹50 note' }).note,
    ).toBe('Short by a ₹50 note');
    expect(() => closeShift({ ...base, countedCashPaise: -1 })).toThrow(RangeError);
  });

  it('short is negative, over is positive', () => {
    expect(cashDifference(215_000, 219_900)).toBe(-4_900);
    expect(cashDifference(220_000, 219_900)).toBe(100);
  });
});
