import { brand } from '@repo/config/brand';
import type { StoredShift } from '@repo/db';
import { cashDifference, type ShiftSummary } from '@repo/pos-core';
import { Avatar, Button, formatINR, Icon, NumberPad, PriceTag } from '@repo/ui';
import { Printer } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { TopBarProps } from '../components/TopBar.tsx';
import { LedgerRow } from '../components/Ledger.tsx';
import { differenceText } from '../lib/cash.ts';

function Frame({
  outletName,
  deviceCode,
  staff,
  endAction,
  children,
  banner,
}: {
  outletName: string;
  deviceCode: string;
  staff: { id: string; name: string };
  endAction: TopBarProps['endAction'];
  children: ReactNode;
  /** A strip under the top bar, e.g. "signed in offline". */
  banner?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 bg-ink px-3 text-canvas">
        <span className="font-display text-lg font-semibold">{brand.pos.name}</span>
        <span className="truncate text-sm text-canvas/70">
          {outletName} · {deviceCode}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Avatar name={staff.name} id={staff.id} size={32} />
          <span className="hidden text-sm font-medium sm:inline">{staff.name}</span>
          <button
            type="button"
            onClick={endAction.onClick}
            className="ml-1 flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium active:bg-canvas/10"
          >
            <Icon icon={endAction.icon} size={18} />
            {endAction.label}
          </button>
        </div>
      </header>
      {banner}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-6">
        {children}
      </main>
    </div>
  );
}

type FrameProps = Omit<Parameters<typeof Frame>[0], 'children'>;

/** Before the first bill: count the cash in the drawer. */
export function StartDay({
  onStart,
  lastCountedPaise,
  ...frame
}: FrameProps & {
  onStart: (openingCashPaise: number) => Promise<void>;
  /** Yesterday's counted cash, offered as a one-tap answer. */
  lastCountedPaise?: number;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const paise = Number(value || '0') * 100;

  const start = () => {
    if (busy) return;
    setBusy(true);
    onStart(paise).catch(() => {
      setBusy(false);
    });
  };

  return (
    <Frame {...frame}>
      <div className="grid items-start gap-8 md:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Start the day</h1>
            <p className="mt-1 text-ink-2">
              Count the cash in the drawer before the first bill. At day close you count it again,
              and the log book shows if anything is short.
            </p>
          </div>
          <div className="flex items-baseline justify-between border-y border-line py-4">
            <span className="text-ink-2">Cash in the drawer</span>
            <PriceTag paise={paise} size="xl" className="!text-[44px]" />
          </div>
          {lastCountedPaise !== undefined && lastCountedPaise > 0 ? (
            <button
              type="button"
              onClick={() => {
                setValue(String(lastCountedPaise / 100));
              }}
              className="h-12 self-start rounded-md border border-line-strong bg-surface px-4 text-base font-medium active:bg-sunken"
            >
              Same as last close · {formatINR(lastCountedPaise)}
            </button>
          ) : null}
          <Button
            variant="accent"
            size="lg"
            disabled={busy}
            onClick={start}
            className="text-lg md:self-start"
          >
            Start the day with {formatINR(paise)}
          </Button>
        </div>
        <NumberPad
          label="Opening cash"
          value={value}
          onChange={setValue}
          doubleZero
          maxLength={6}
          captureKeyboard
          onEnter={start}
          className="self-start"
        />
      </div>
    </Frame>
  );
}

/** Right after closing: the day's page, ready to print and keep with the cash. */
export function DayClosed({
  shift,
  summary,
  onPrint,
  onDone,
  ...frame
}: FrameProps & {
  shift: StoredShift;
  summary: ShiftSummary;
  onPrint: () => void;
  onDone: () => void;
}) {
  const difference = cashDifference(shift.close?.countedCashPaise ?? 0, summary.expectedCashPaise);
  return (
    <Frame {...frame}>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Day closed</h1>
          <p className="mt-1 text-ink-2">
            {summary.bills} {summary.bills === 1 ? 'bill' : 'bills'} ·{' '}
            {formatINR(summary.salesPaise)} in sales. It&rsquo;s in the log book for the owner.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4">
          <LedgerRow label="Expected in drawer" paise={summary.expectedCashPaise} />
          <LedgerRow label="Counted" paise={shift.close?.countedCashPaise ?? 0} />
          <LedgerRow
            label="Difference"
            detail={differenceText(difference)}
            paise={Math.abs(difference)}
            strong
            {...(difference < 0 ? { tone: 'danger' as const } : {})}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={onPrint}>
            <Icon icon={Printer} size={18} />
            Print day close slip
          </Button>
          <Button variant="primary" size="lg" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </Frame>
  );
}
