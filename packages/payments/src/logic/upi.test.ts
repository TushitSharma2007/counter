import { describe, expect, it } from 'vitest';
import { isValidVpa, upiIntentAdapter, upiIntentUri } from './upi.ts';

describe('upiIntentUri', () => {
  it('builds the link a UPI app opens with the amount filled in', () => {
    expect(
      upiIntentUri({
        vpa: 'democoffee@okaxis',
        payeeName: 'Demo Coffee Co.',
        amountPaise: 35_600,
        note: 'ARC-T1/2627/000012',
      }),
    ).toBe(
      'upi://pay?pa=democoffee%40okaxis&pn=Demo%20Coffee%20Co.&am=356.00&cu=INR&tn=ARC-T1%2F2627%2F000012',
    );
  });

  it('keeps paise', () => {
    expect(
      upiIntentUri({ vpa: 'a.b@ybl', payeeName: 'X', amountPaise: 14_950, note: 'n' }),
    ).toContain('am=149.50');
  });

  it('refuses a bad UPI ID or amount', () => {
    expect(() =>
      upiIntentUri({ vpa: 'not-a-vpa', payeeName: 'X', amountPaise: 100, note: '' }),
    ).toThrow(RangeError);
    expect(() => upiIntentUri({ vpa: 'a@ybl', payeeName: 'X', amountPaise: 0, note: '' })).toThrow(
      RangeError,
    );
  });
});

describe('isValidVpa', () => {
  it('accepts common handles and rejects junk', () => {
    for (const ok of ['priya.sharma@okicici', '9826012345@paytm', 'demo-coffee@ybl'])
      expect(isValidVpa(ok)).toBe(true);
    for (const bad of ['', '@ybl', 'name@', 'name@1bank', 'a b@ybl'])
      expect(isValidVpa(bad)).toBe(false);
  });
});

describe('upiIntentAdapter', () => {
  it('asks for a QR that the cashier confirms by hand', () => {
    const prompt = upiIntentAdapter({ vpa: 'demo@ybl', name: 'Demo' }).request({
      amountPaise: 4_900,
      note: 'Bill 1',
    });
    expect(prompt.kind).toBe('qr');
    expect(prompt.confirm).toBe('manual');
    expect(prompt.uri.startsWith('upi://pay?pa=demo%40ybl')).toBe(true);
  });
});
