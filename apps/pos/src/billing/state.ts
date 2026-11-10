// Billing screen state: the open bill, held bills and search. Nothing is saved yet; orders and the
// offline outbox (CLAUDE.md §7) come with the billing milestone.
import {
  cartReducer,
  computeBill,
  DEFAULT_TAX,
  EMPTY_CART,
  itemCount,
  type Cart,
  type CartAction,
  type TaxSettings,
} from '@repo/pos-core';
import { useMemo, useReducer, useState } from 'react';

export interface HeldBill {
  id: string;
  cart: Cart;
  heldAt: Date;
}

export function useBilling(tax: TaxSettings = DEFAULT_TAX) {
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [held, setHeld] = useState<HeldBill[]>([]);

  const totals = useMemo(() => computeBill(cart.lines, tax), [cart.lines, tax]);
  const count = itemCount(cart);

  const hold = () => {
    if (cart.lines.length === 0) return;
    setHeld((list) => [...list, { id: crypto.randomUUID(), cart, heldAt: new Date() }]);
    dispatch({ type: 'clear' });
  };

  /** Brings a held bill back; the bill on screen (if any) is held in its place. */
  const resume = (id: string) => {
    const bill = held.find((h) => h.id === id);
    if (!bill) return;
    setHeld((list) => {
      const rest = list.filter((h) => h.id !== id);
      return cart.lines.length > 0
        ? [...rest, { id: crypto.randomUUID(), cart, heldAt: new Date() }]
        : rest;
    });
    dispatch({ type: 'restore', cart: bill.cart });
  };

  return {
    cart,
    dispatch: dispatch as (action: CartAction) => void,
    totals,
    count,
    held,
    hold,
    resume,
  };
}
