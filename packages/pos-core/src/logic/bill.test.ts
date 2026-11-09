import { describe, expect, it } from 'vitest';
import { cashChange, computeBill, DEFAULT_TAX, type TaxSettings } from './bill.ts';

const coldCoffee = { unitPaise: 14_900, qty: 1, taxRateBp: 500 };

describe('computeBill, prices include 5% GST (the café default)', () => {
  it('pulls the tax out of the price and splits it CGST/SGST', () => {
    const bill = computeBill([coldCoffee]);
    // 149 / 1.05 = 141.904… → taxable ₹141.90, tax ₹7.10
    expect(bill.taxablePaise).toBe(14_190);
    expect(bill.cgstPaise).toBe(355);
    expect(bill.sgstPaise).toBe(355);
    expect(bill.itemTotalPaise).toBe(14_900);
    expect(bill.totalPaise).toBe(14_900);
    expect(bill.roundOffPaise).toBe(0);
  });

  it('adds up quantities and lines, and always balances', () => {
    const bill = computeBill([
      { ...coldCoffee, qty: 2 },
      { unitPaise: 3_900, qty: 1, taxRateBp: 500 },
    ]);
    expect(bill.itemTotalPaise).toBe(33_700);
    expect(bill.taxablePaise + bill.cgstPaise + bill.sgstPaise).toBe(33_700);
  });

  it('gives an odd paisa of tax to CGST', () => {
    // ₹49 incl. 5%: taxable 46.67, tax 2.33 → CGST 1.17, SGST 1.16
    const bill = computeBill([{ unitPaise: 4_900, qty: 1, taxRateBp: 500 }]);
    expect(bill.cgstPaise).toBe(117);
    expect(bill.sgstPaise).toBe(116);
  });

  it('rounds the total to the rupee with a round-off line', () => {
    const up = computeBill([{ unitPaise: 14_950, qty: 1, taxRateBp: 500 }]);
    expect(up.totalPaise).toBe(15_000);
    expect(up.roundOffPaise).toBe(50);
    const down = computeBill([{ unitPaise: 14_930, qty: 1, taxRateBp: 500 }]);
    expect(down.totalPaise).toBe(14_900);
    expect(down.roundOffPaise).toBe(-30);
  });

  it('keeps separate rates separate', () => {
    const bill = computeBill([coldCoffee, { unitPaise: 11_800, qty: 1, taxRateBp: 1_800 }]);
    expect(bill.taxGroups.map((g) => g.rateBp)).toEqual([500, 1_800]);
  });
});

describe('computeBill, other settings', () => {
  it('adds tax on top when prices exclude it', () => {
    const settings: TaxSettings = { ...DEFAULT_TAX, pricesIncludeTax: false };
    const bill = computeBill([coldCoffee], settings);
    expect(bill.taxablePaise).toBe(14_900);
    expect(bill.cgstPaise + bill.sgstPaise).toBe(745);
    expect(bill.totalPaise).toBe(15_600); // ₹156.45 → ₹156
    expect(bill.roundOffPaise).toBe(-45);
  });

  it('charges no tax under the composition scheme', () => {
    const bill = computeBill([coldCoffee], { ...DEFAULT_TAX, gstScheme: 'composition' });
    expect(bill.taxGroups).toEqual([]);
    expect(bill.cgstPaise + bill.sgstPaise).toBe(0);
    expect(bill.totalPaise).toBe(14_900);
  });

  it('balances whether tax is rounded per line or per bill', () => {
    const lines = Array.from({ length: 3 }, () => ({ unitPaise: 4_900, qty: 1, taxRateBp: 500 }));
    const perLine = computeBill(lines, { ...DEFAULT_TAX, rounding: 'line' });
    const perBill = computeBill(lines, { ...DEFAULT_TAX, rounding: 'bill' });
    for (const bill of [perLine, perBill]) {
      expect(bill.taxablePaise + bill.cgstPaise + bill.sgstPaise).toBe(14_700);
    }
    expect(Math.abs(perLine.taxablePaise - perBill.taxablePaise)).toBeLessThanOrEqual(3);
  });

  it('is zero for an empty bill', () => {
    expect(computeBill([]).totalPaise).toBe(0);
  });

  it('rejects fractional paise and bad quantities', () => {
    expect(() => computeBill([{ unitPaise: 10.5, qty: 1, taxRateBp: 500 }])).toThrow(RangeError);
    expect(() => computeBill([{ unitPaise: 100, qty: 0, taxRateBp: 500 }])).toThrow(RangeError);
  });
});

describe('cashChange', () => {
  it('returns change, or a negative amount still owed', () => {
    expect(cashChange(39_600, 50_000)).toBe(10_400);
    expect(cashChange(39_600, 20_000)).toBe(-19_600);
  });
});
