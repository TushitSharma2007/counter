import { cashChange, type PaymentMode } from '@repo/pos-core';
import {
  Button,
  cx,
  Dialog,
  DialogContent,
  formatINR,
  NumberPad,
  PriceTag,
  Segmented,
} from '@repo/ui';
import { useState } from 'react';
import { PAYMENT_MODES } from './options.ts';
import { UpiQr } from './UpiQr.tsx';

export interface Payment {
  mode: Exclude<PaymentMode, 'split'>;
  tenderedPaise?: number;
}

/** Note amounts a customer is likely to hand over for this total. */
function quickAmounts(totalPaise: number): number[] {
  const rupees = totalPaise / 100;
  const ups = [100, 500, 2000].map((step) => Math.ceil(rupees / step) * step);
  return [...new Set([rupees, ...ups])].filter((r) => r >= rupees).slice(0, 4);
}

export function PayDialog({
  open,
  totalPaise,
  initialMode,
  upi,
  onClose,
  onPaid,
}: {
  open: boolean;
  totalPaise: number;
  initialMode: PaymentMode;
  /** The outlet's UPI ID and the name customers see; undefined when not set up. */
  upi: { vpa: string; payeeName: string } | undefined;
  onClose: () => void;
  onPaid: (payment: Payment) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open ? (
        <PayBody
          totalPaise={totalPaise}
          initialMode={initialMode === 'split' ? 'cash' : initialMode}
          upi={upi}
          onPaid={onPaid}
        />
      ) : null}
    </Dialog>
  );
}

function PayBody({
  totalPaise,
  initialMode,
  upi,
  onPaid,
}: {
  totalPaise: number;
  initialMode: Payment['mode'];
  upi: { vpa: string; payeeName: string } | undefined;
  onPaid: (payment: Payment) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [received, setReceived] = useState(String(totalPaise / 100));
  const receivedPaise = Number(received || '0') * 100;
  const change = cashChange(totalPaise, receivedPaise);
  const canConfirm = mode === 'cash' ? change >= 0 : true;

  const confirm = () => {
    if (!canConfirm) return;
    onPaid(mode === 'cash' ? { mode, tenderedPaise: receivedPaise } : { mode });
  };

  return (
    <DialogContent
      title="Take payment"
      size="lg"
      footer={
        <Button
          variant="accent"
          size="lg"
          disabled={!canConfirm}
          onClick={confirm}
          className="w-full text-lg sm:w-auto sm:min-w-56"
        >
          {mode === 'cash' ? 'Bill paid' : 'Payment received'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <span className="text-ink-2">Total</span>
          <PriceTag paise={totalPaise} size="xl" className="!text-[44px]" />
        </div>
        <Segmented
          label="Payment mode"
          size="lg"
          value={mode}
          options={PAYMENT_MODES}
          onChange={setMode}
        />

        {mode === 'cash' ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_17rem]">
            <div className="flex flex-col">
              <div className="flex items-baseline justify-between border-b border-line py-3">
                <span className="text-ink-2">Received</span>
                <PriceTag paise={receivedPaise} size="lg" />
              </div>
              <div className="flex items-baseline justify-between py-3">
                <span className="text-ink-2">
                  {change >= 0 ? 'Change to return' : 'Still to pay'}
                </span>
                <PriceTag
                  paise={Math.abs(change)}
                  size="lg"
                  className={change >= 0 ? 'text-success' : 'text-danger'}
                />
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2">
                {quickAmounts(totalPaise).map((rupees, i) => (
                  <button
                    key={rupees}
                    type="button"
                    onClick={() => {
                      setReceived(String(rupees));
                    }}
                    className={cx(
                      'h-12 rounded-md border px-3 text-base font-medium',
                      receivedPaise === rupees * 100
                        ? 'border-accent bg-accent-soft'
                        : 'border-line-strong bg-surface active:bg-sunken',
                    )}
                  >
                    {i === 0 ? 'Exact' : formatINR(rupees * 100)}
                  </button>
                ))}
              </div>
            </div>
            <NumberPad
              label="Cash received"
              value={received}
              onChange={setReceived}
              doubleZero
              maxLength={6}
              captureKeyboard
              onEnter={confirm}
            />
          </div>
        ) : null}

        {mode === 'upi' && upi ? (
          <UpiQr
            vpa={upi.vpa}
            payeeName={upi.payeeName}
            amountPaise={totalPaise}
            note={`${upi.payeeName} bill`}
          />
        ) : null}
        {mode === 'upi' && !upi ? (
          <p className="rounded-md bg-sunken p-4 text-base">
            Ask the customer to pay {formatINR(totalPaise)} by UPI, then confirm. To show a QR with
            the amount filled in, the owner adds this outlet&rsquo;s UPI ID in My outlets.
          </p>
        ) : null}
        {mode === 'card' ? (
          <p className="rounded-md bg-sunken p-4 text-base">
            Charge {formatINR(totalPaise)} on the card machine, then confirm.
          </p>
        ) : null}
      </div>
    </DialogContent>
  );
}
