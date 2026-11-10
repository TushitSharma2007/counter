import { describe, expect, it } from 'vitest';
import { formatINR, parseRupees, rupeesText } from './money.ts';

describe('formatINR', () => {
  it('drops .00 on whole rupees by default', () => {
    expect(formatINR(14900)).toBe('₹149');
  });

  it('keeps paise when there are some', () => {
    expect(formatINR(14950)).toBe('₹149.50');
  });

  it('always shows two decimals on bills', () => {
    expect(formatINR(14900, { decimals: 'always' })).toBe('₹149.00');
  });

  it('groups in lakh and crore', () => {
    expect(formatINR(12_345_678)).toBe('₹1,23,456.78');
    expect(formatINR(1_00_00_000_00)).toBe('₹1,00,00,000');
  });

  it('formats zero and negatives', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(-5000)).toBe('-₹50');
  });

  it('rejects fractional paise', () => {
    expect(() => formatINR(10.5)).toThrow(RangeError);
  });
});

describe('parseRupees / rupeesText', () => {
  it('reads what people type in a price field', () => {
    expect(parseRupees('149')).toBe(14_900);
    expect(parseRupees('149.5')).toBe(14_950);
    expect(parseRupees('₹1,490.05')).toBe(1_49_005);
    expect(parseRupees(' 0 ')).toBe(0);
  });

  it('rejects anything that is not a price', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1.2.3']) expect(parseRupees(bad)).toBeUndefined();
  });

  it('round-trips', () => {
    expect(rupeesText(14_900)).toBe('149');
    expect(rupeesText(14_950)).toBe('149.50');
    expect(parseRupees(rupeesText(1_49_005))).toBe(1_49_005);
  });
});
