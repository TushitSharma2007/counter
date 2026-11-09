// The bill being built at the counter. A pure reducer, so it is easy to test and to persist.

export type OrderType = 'counter' | 'takeaway' | 'dine_in' | 'delivery';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'due' | 'split';

export interface Modifier {
  id: string;
  name: string;
  pricePaise: number;
}

export interface CartLine {
  /** Same item + variant + modifiers = same key, so repeats add up on one line. */
  key: string;
  itemId: string;
  name: string;
  variant?: { id: string; name: string };
  modifiers: Modifier[];
  /** One unit, including variant and modifiers. */
  unitPaise: number;
  taxRateBp: number;
  qty: number;
}

export interface Cart {
  lines: CartLine[];
  orderType: OrderType;
  /** Loyalty / customer phone: digits only, at most 10. */
  customerPhone: string;
  paymentMode: PaymentMode;
}

export const EMPTY_CART: Cart = {
  lines: [],
  orderType: 'counter',
  customerPhone: '',
  paymentMode: 'cash',
};

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'key' | 'qty'>; qty?: number }
  | { type: 'increment'; key: string }
  | { type: 'decrement'; key: string }
  | { type: 'remove'; key: string }
  | { type: 'clear' }
  | { type: 'restore'; cart: Cart }
  | { type: 'orderType'; value: OrderType }
  | { type: 'customerPhone'; value: string }
  | { type: 'paymentMode'; value: PaymentMode };

export function lineKey(line: Pick<CartLine, 'itemId' | 'variant' | 'modifiers'>): string {
  const mods = line.modifiers
    .map((m) => m.id)
    .sort()
    .join('+');
  return [line.itemId, line.variant?.id ?? '', mods].join('|');
}

export function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case 'add': {
      const key = lineKey(action.line);
      const qty = action.qty ?? 1;
      const existing = cart.lines.some((l) => l.key === key);
      return {
        ...cart,
        lines: existing
          ? cart.lines.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
          : [...cart.lines, { ...action.line, key, qty }],
      };
    }
    case 'increment':
      return {
        ...cart,
        lines: cart.lines.map((l) => (l.key === action.key ? { ...l, qty: l.qty + 1 } : l)),
      };
    case 'decrement':
      return {
        ...cart,
        lines: cart.lines
          .map((l) => (l.key === action.key ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0),
      };
    case 'remove':
      return { ...cart, lines: cart.lines.filter((l) => l.key !== action.key) };
    case 'clear':
      return { ...EMPTY_CART, orderType: cart.orderType };
    case 'restore':
      return action.cart;
    case 'orderType':
      return { ...cart, orderType: action.value };
    case 'customerPhone':
      return { ...cart, customerPhone: action.value.replace(/\D/g, '').slice(-10) };
    case 'paymentMode':
      return { ...cart, paymentMode: action.value };
  }
}

export function itemCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.qty, 0);
}
