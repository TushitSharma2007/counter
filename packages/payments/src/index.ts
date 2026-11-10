// PaymentAdapter: upi-intent today; razorpay | cashfree later, behind the same interface.
export type { PaymentAdapter, PaymentPrompt, PaymentRequest } from './adapter.ts';
export { isValidVpa, upiIntentAdapter, upiIntentUri } from './logic/upi.ts';
