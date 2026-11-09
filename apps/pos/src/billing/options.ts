import type { OrderType, PaymentMode } from '@repo/pos-core';

export const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'counter', label: 'Counter' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'delivery', label: 'Delivery' },
];

export const PAYMENT_MODES: { value: Exclude<PaymentMode, 'split'>; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'due', label: 'Due' },
];
