// Every way of taking money sits behind this (CLAUDE.md §2), so a gateway can replace UPI intent
// later without touching billing code.

export interface PaymentRequest {
  amountPaise: number;
  /** Shown in the customer's UPI app, e.g. the bill number. */
  note: string;
}

/** A QR for the customer to scan; the cashier confirms when the money arrives. */
export interface PaymentPrompt {
  kind: 'qr';
  uri: string;
  confirm: 'manual';
}

export interface PaymentAdapter {
  id: string;
  request(payment: PaymentRequest): PaymentPrompt;
}
