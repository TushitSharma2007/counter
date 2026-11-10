import type { StoredShift } from '@repo/db';
import { cashDifference, type CashMovement, type ShiftSummary } from '@repo/pos-core';
import {
  Button,
  cx,
  formatINR,
  Icon,
  Input,
  NumberPad,
  PriceTag,
  Sheet,
  SheetContent,
  toast,
} from '@repo/ui';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { LedgerRow } from '../components/Ledger.tsx';
import { CASH_REASONS, differenceText } from '../lib/cash.ts';

const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

type View = 'summary' | CashMovement['kind'] | 'close';

const TITLE: Record<View, string> = {
  summary: 'Cash drawer',
  in: 'Cash in',
  out: 'Cash out',
  close: 'Close the day',
};

/** The drawer during the day: what should be in it, cash in or out, and closing the day. */
export function DrawerSheet({
  open,
  shift,
  summary,
  onClose,
  onMove,
  onCloseDay,
}: {
  open: boolean;
  shift: StoredShift;
  summary: ShiftSummary;
  onClose: () => void;
  onMove: (kind: CashMovement['kind'], amountPaise: number, reason: string) => Promise<void>;
  onCloseDay: (countedCashPaise: number, note: string) => Promise<void>;
}) {
  const [view, setView] = useState<View>('summary');

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setView('summary');
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        title={TITLE[view]}
        {...(view === 'summary'
          ? {
              description: `Started ${time.format(new Date(shift.open.openedAt))} by ${shift.open.openedByName}`,
            }
          : {})}
        className="!max-w-lg"
      >
        {view === 'summary' ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between border-b border-line pb-3">
              <span className="text-ink-2">Should be in the drawer</span>
              <PriceTag paise={summary.expectedCashPaise} size="xl" />
            </div>
            <div>
              <LedgerRow label="Opening cash" paise={shift.open.openingCashPaise} />
              <LedgerRow
                label="Cash sales"
                detail="What bills took, after change"
                paise={summary.cashSalesPaise}
                sign="+"
              />
              {shift.movements.map((m) => (
                <LedgerRow
                  key={m.id}
                  label={m.reason}
                  detail={`${m.kind === 'in' ? 'Cash in' : 'Cash out'} · ${time.format(new Date(m.at))} · ${m.byName}`}
                  paise={m.amountPaise}
                  sign={m.kind === 'in' ? '+' : '−'}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                onClick={() => {
                  setView('in');
                }}
              >
                Cash in
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  setView('out');
                }}
              >
                Cash out
              </Button>
            </div>

            <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div>
                <dt className="text-sm text-ink-2">Sales</dt>
                <dd className="num font-medium">{formatINR(summary.salesPaise)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-2">UPI</dt>
                <dd className="num font-medium">{formatINR(summary.upiSalesPaise)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-2">Card</dt>
                <dd className="num font-medium">{formatINR(summary.cardSalesPaise)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-2">Bills</dt>
                <dd className="num font-medium">{summary.bills}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-2">Voids</dt>
                <dd className="num font-medium">{summary.voids}</dd>
              </div>
            </dl>

            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setView('close');
              }}
            >
              Close the day
            </Button>
          </div>
        ) : null}

        {view === 'in' || view === 'out' ? (
          <MoveForm
            key={view}
            kind={view}
            onBack={() => {
              setView('summary');
            }}
            onSave={async (amount, reason) => {
              await onMove(view, amount, reason);
              toast({
                title: view === 'in' ? 'Cash in noted' : 'Cash out noted',
                description: `${formatINR(amount)} · ${reason}`,
                tone: 'success',
              });
              setView('summary');
            }}
          />
        ) : null}

        {view === 'close' ? (
          <CloseForm
            expectedPaise={summary.expectedCashPaise}
            onBack={() => {
              setView('summary');
            }}
            onSave={async (counted, note) => {
              await onCloseDay(counted, note);
              setView('summary');
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" className="-ml-2 self-start" onClick={onBack}>
      <Icon icon={ArrowLeft} size={18} />
      Cash drawer
    </Button>
  );
}

function MoveForm({
  kind,
  onBack,
  onSave,
}: {
  kind: CashMovement['kind'];
  onBack: () => void;
  onSave: (amountPaise: number, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const paise = Number(amount || '0') * 100;
  const ok = paise > 0 && reason.trim().length > 0 && !busy;

  const save = () => {
    if (!ok) return;
    setBusy(true);
    onSave(paise, reason.trim()).catch(() => {
      setBusy(false);
      toast({ title: 'Couldn’t save', tone: 'danger' });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <BackButton onBack={onBack} />
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <span className="text-ink-2">{kind === 'in' ? 'Put into the drawer' : 'Taken out'}</span>
        <PriceTag paise={paise} size="xl" />
      </div>
      <NumberPad
        label={kind === 'in' ? 'Cash in amount' : 'Cash out amount'}
        value={amount}
        onChange={setAmount}
        doubleZero
        maxLength={6}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Reason</legend>
        <div className="flex flex-wrap gap-2">
          {CASH_REASONS[kind].map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => {
                setReason(r);
              }}
              className={cx(
                'h-11 rounded-md border px-3 text-sm font-medium',
                reason === r
                  ? 'border-accent bg-accent-soft'
                  : 'border-line-strong bg-surface active:bg-sunken',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Input
          label="Or type a reason"
          hideLabel
          placeholder="Or type a reason"
          value={reason}
          maxLength={200}
          onChange={(e) => {
            setReason(e.target.value);
          }}
        />
      </fieldset>
      <Button variant="accent" size="lg" disabled={!ok} onClick={save}>
        {kind === 'in' ? 'Note cash in' : 'Note cash out'} · {formatINR(paise)}
      </Button>
    </div>
  );
}

function CloseForm({
  expectedPaise,
  onBack,
  onSave,
}: {
  expectedPaise: number;
  onBack: () => void;
  onSave: (countedPaise: number, note: string) => Promise<void>;
}) {
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const paise = Number(counted || '0') * 100;
  const difference = cashDifference(paise, expectedPaise);
  const ok = counted !== '' && !busy;

  const save = () => {
    if (!ok) return;
    setBusy(true);
    onSave(paise, note).catch(() => {
      setBusy(false);
      toast({ title: 'Couldn’t close the day', tone: 'danger' });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <BackButton onBack={onBack} />
      <p className="text-ink-2">Count every note and coin in the drawer, then enter the total.</p>
      <div>
        <div className="flex items-baseline justify-between border-b border-line py-2">
          <span className="text-ink-2">Counted</span>
          <PriceTag paise={paise} size="xl" />
        </div>
        <div className="flex items-baseline justify-between py-2">
          <span className="text-ink-2">
            {counted === '' ? 'Difference' : differenceText(difference)}
          </span>
          <PriceTag
            paise={Math.abs(difference)}
            size="lg"
            className={cx(
              counted === '' && 'text-ink-3',
              counted !== '' && difference < 0 && 'text-danger',
              counted !== '' && difference === 0 && 'text-success',
            )}
          />
        </div>
      </div>
      <NumberPad
        label="Counted cash"
        value={counted}
        onChange={setCounted}
        doubleZero
        maxLength={6}
      />
      <Input
        label="Note for the owner (optional)"
        placeholder={difference < 0 ? 'e.g. gave ₹50 change from my pocket' : ''}
        value={note}
        maxLength={500}
        onChange={(e) => {
          setNote(e.target.value);
        }}
      />
      <Button variant="primary" size="lg" disabled={!ok} onClick={save}>
        Close the day
      </Button>
    </div>
  );
}
