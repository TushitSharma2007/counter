import type { BillingContext } from '@repo/db';
import type { OrderPayload } from '@repo/pos-core';
import { formatINR } from '@repo/ui';

/** A plain-text bill for WhatsApp (wa.me, free). */
export function whatsAppText(bill: OrderPayload, context: BillingContext): string {
  const lines = bill.lines.map(
    (l) =>
      `${l.name}${l.variantName ? ` (${l.variantName})` : ''} × ${l.qty}  ${formatINR(l.lineTotalPaise)}`,
  );
  return [
    `${context.org.name}, ${context.outlet.name}`,
    `Bill ${bill.billNumber}`,
    '',
    ...lines,
    '',
    `Total ${formatINR(bill.totals.totalPaise)}`,
    'Thank you! Visit again.',
  ].join('\n');
}

export function whatsAppLink(bill: OrderPayload, context: BillingContext): string {
  const text = encodeURIComponent(whatsAppText(bill, context));
  return bill.customerPhone
    ? `https://wa.me/91${bill.customerPhone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}
