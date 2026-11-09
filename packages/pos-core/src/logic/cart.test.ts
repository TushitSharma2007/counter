import { describe, expect, it } from 'vitest';
import { cartReducer, EMPTY_CART, itemCount, type CartAction } from './cart.ts';

const latte = {
  itemId: 'latte',
  name: 'Hazelnut Latte',
  modifiers: [],
  unitPaise: 17_900,
  taxRateBp: 500,
};
const large = { id: 'L', name: 'Large' };
const oat = { id: 'oat', name: 'Oat milk', pricePaise: 5_000 };
const shot = { id: 'shot', name: 'Extra shot', pricePaise: 4_000 };

const run = (...actions: CartAction[]) => actions.reduce(cartReducer, EMPTY_CART);

describe('cartReducer', () => {
  it('adds up repeats of the same item on one line', () => {
    const cart = run({ type: 'add', line: latte }, { type: 'add', line: latte });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.qty).toBe(2);
  });

  it('keeps sizes and add-ons on separate lines, whatever order add-ons were picked in', () => {
    const cart = run(
      { type: 'add', line: latte },
      { type: 'add', line: { ...latte, variant: large } },
      { type: 'add', line: { ...latte, variant: large, modifiers: [oat, shot] } },
      { type: 'add', line: { ...latte, variant: large, modifiers: [shot, oat] } },
    );
    expect(cart.lines.map((l) => l.qty)).toEqual([1, 1, 2]);
  });

  it('removes a line when its quantity reaches zero', () => {
    const added = run({ type: 'add', line: latte });
    const key = added.lines[0]?.key ?? '';
    expect(cartReducer(added, { type: 'decrement', key }).lines).toEqual([]);
  });

  it('keeps the last 10 digits of a phone number, so +91 and spaces are fine', () => {
    expect(run({ type: 'customerPhone', value: '+91 98260-12345' }).customerPhone).toBe(
      '9826012345',
    );
    expect(run({ type: 'customerPhone', value: '98260' }).customerPhone).toBe('98260');
  });

  it('clears the bill but keeps the order type for the next customer', () => {
    const cart = run(
      { type: 'orderType', value: 'takeaway' },
      { type: 'add', line: latte },
      { type: 'clear' },
    );
    expect(cart.lines).toEqual([]);
    expect(cart.orderType).toBe('takeaway');
  });

  it('restores a held bill exactly', () => {
    const held = run({ type: 'orderType', value: 'dine_in' }, { type: 'add', line: latte, qty: 2 });
    expect(run({ type: 'restore', cart: held })).toEqual(held);
  });

  it('counts items across lines', () => {
    const cart = run(
      { type: 'add', line: latte, qty: 3 },
      { type: 'add', line: { ...latte, variant: large } },
    );
    expect(itemCount(cart)).toBe(4);
  });
});
