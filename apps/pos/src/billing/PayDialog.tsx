import { cashChange, type PaymentPart } from '@repo/pos-core';
import {
  Button,
  cx,
  Dialog,
  DialogContent,
  formatINR,
  Icon,
  NumberPad,
  PriceTag,
  Segmented,
} from '@repo/ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { PAYMENT_MODES } from './options.ts';
import { UpiQr } from './UpiQr.tsx';

type Mode = PaymentPart['mode'];
type Choice = Mode | 'split';

const MODE_LABEL: Record<Mode, string> = { cash: 'Cash', upi: 'UPI', card: 'Card' };

const CHOICES: { value: Choice; label: string }[] = [
  ...PAYMENT_MODES,
  { value: 'split', label: 'Split' },
];

/** Note amounts a customer is likely to hand over for this total. */
function quickAmounts(totalPaise: number): number[] {
  const rupees = totalPaise / 100;
  const ups = [100, 500, 2000].map((step) => Math.ceil(rupees / step) * step);
  return [...new Set([rupees, ...ups])].filter((r) => r >= rupees).slice(0, 4);
}

type Upi = { vpa: string; payeeName: string } | undefined;

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
  initialMode: Choice;
  /** The outlet's UPI ID and the name customers see; undefined when not set up. */
  upi: Upi;
  onClose: () => void;
  onPaid: (payments: PaymentPart[]) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open ? (
        <PayBody totalPaise={totalPaise} initialMode={initialMode} upi={upi} onPaid={onPaid} />
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
  initialMode: Choice;
  upi: Upi;
  onPaid: (payments: PaymentPart[]) => void;
}) {
  const [choice, setChoice] = useState<Choice>(initialMode);
  const [received, setReceived] = useState(String(totalPaise / 100));
  const receivedPaise = Number(received || '0') * 100;
  const change = cashChange(totalPaise, receivedPaise);

  // Split: parts taken so far, and the part being added.
  const [parts, setParts] = useState<PaymentPart[]>([]);
  const remaining = totalPaise - parts.reduce((s, p) => s + p.amountPaise, 0);
  const [partMode, setPartMode] = useState<Mode>('cash');
  const [partAmount, setPartAmount] = useState('');
  const partPaise = partAmount ? Number(partAmount) * 100 : remaining;
  const partOk = partPaise > 0 && partPaise <= remaining;

  const canConfirm =
    choice === 'split'
      ? remaining === 0 && parts.length > 0
      : choice === 'cash'
        ? change >= 0
        : true;

  const confirm = () => {
    if (!canConfirm) return;
    if (choice === 'split') onPaid(parts);
    else if (choice === 'cash')
      onPaid([{ mode: 'cash', amountPaise: totalPaise, tenderedPaise: receivedPaise }]);
    else onPaid([{ mode: choice, amountPaise: totalPaise }]);
  };

  const addPart = () => {
    if (!partOk) return;
    setParts([...parts, { mode: partMode, amountPaise: partPaise }]);
    setPartAmount('');
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
          {choice === 'cash' || choice === 'split' ? 'Bill paid' : 'Payment received'}
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
          value={choice}
          options={CHOICES}
          onChange={setChoice}
        />

        {choice === 'cash' ? (
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
              className="self-start"
              value={received}
              onChange={setReceived}
              doubleZero
              maxLength={6}
              captureKeyboard
              onEnter={confirm}
            />
          </div>
        ) : null}

        {choice === 'upi' && upi ? (
          <UpiQr
            vpa={upi.vpa}
            payeeName={upi.payeeName}
            amountPaise={totalPaise}
            note={`${upi.payeeName} bill`}
          />
        ) : null}
        {choice === 'upi' && !upi ? (
          <p className="rounded-md bg-sunken p-4 text-base">
            Ask the customer to pay {formatINR(totalPaise)} by UPI, then confirm. To show a QR with
            the amount filled in, the owner adds this outlet&rsquo;s UPI ID in My outlets.
          </p>
        ) : null}
        {choice === 'card' ? (
          <p className="rounded-md bg-sunken p-4 text-base">
            Charge {formatINR(totalPaise)} on the card machine, then confirm.
          </p>
        ) : null}

        {choice === 'split' ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_17rem]">
            <div className="flex flex-col gap-3">
              <ul aria-label="Payments so far" className="flex flex-col">
                {parts.map((part, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between border-b border-line py-2"
                  >
                    <span className="font-medium">{MODE_LABEL[part.mode]}</span>
                    <span className="flex items-center gap-1">
                      <PriceTag paise={part.amountPaise} />
                      <Button
                        variant="ghost"
                        aria-label={`Remove ${MODE_LABEL[part.mode]} ${formatINR(part.amountPaise)}`}
                        className="w-tap px-0"
                        onClick={() => {
                          setParts(parts.filter((_, j) => j !== i));
                        }}
                      >
                        <Icon icon={X} size={16} />
                      </Button>
                    </span>
                  </li>
                ))}
                <li className="flex items-baseline justify-between py-2">
                  <span className="text-ink-2">{remaining === 0 ? 'All paid' : 'Left to pay'}</span>
                  <PriceTag
                    paise={remaining}
                    size="lg"
                    className={remaining === 0 ? 'text-success' : ''}
                  />
                </li>
              </ul>
              {remaining > 0 ? (
                <>
                  <Segmented
                    label="Pay part by"
                    value={partMode}
                    options={PAYMENT_MODES}
                    onChange={setPartMode}
                  />
                  {partMode === 'upi' && upi && partOk ? (
                    <UpiQr
                      vpa={upi.vpa}
                      payeeName={upi.payeeName}
                      amountPaise={partPaise}
                      compact
                      note={`${upi.payeeName} bill`}
                    />
                  ) : null}
                  <Button variant="primary" size="lg" disabled={!partOk} onClick={addPart}>
                    Add {formatINR(partOk ? partPaise : 0)} by {MODE_LABEL[partMode]}
                  </Button>
                  {!partOk && partAmount ? (
                    <p className="text-sm text-danger">That&rsquo;s more than is left to pay.</p>
                  ) : null}
                </>
              ) : null}
            </div>
            {remaining > 0 ? (
              <NumberPad
                label="Amount for this part"
                className="self-start"
                value={partAmount}
                onChange={setPartAmount}
                doubleZero
                maxLength={6}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </DialogContent>
  );
}
