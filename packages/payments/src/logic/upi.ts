// UPI intent (NPCI "upi://pay" links): free, no gateway. Any UPI app scanning the QR opens with the
// amount filled in. Nothing tells us the money arrived, so the cashier confirms by hand.
import type { PaymentAdapter, PaymentRequest } from '../adapter.ts';

const VPA = /^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$/; // same rule as outlets_upi_vpa_check

export function isValidVpa(vpa: string): boolean {
  return VPA.test(vpa.trim());
}

export function upiIntentUri({
  vpa,
  payeeName,
  amountPaise,
  note,
}: PaymentRequest & { vpa: string; payeeName: string }): string {
  if (!isValidVpa(vpa)) throw new RangeError(`Not a UPI ID: ${vpa}`);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0)
    throw new RangeError('UPI amount must be positive paise');
  const params = [
    ['pa', vpa.trim()],
    ['pn', payeeName.trim().slice(0, 50)],
    ['am', (amountPaise / 100).toFixed(2)],
    ['cu', 'INR'],
    ['tn', note.trim().slice(0, 80)],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`).join('&')}`;
}

export function upiIntentAdapter(payee: { vpa: string; name: string }): PaymentAdapter {
  return {
    id: 'upi-intent',
    request: (payment) => ({
      kind: 'qr',
      uri: upiIntentUri({ ...payment, vpa: payee.vpa, payeeName: payee.name }),
      confirm: 'manual',
    }),
  };
}
