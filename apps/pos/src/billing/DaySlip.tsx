import type { StoredShift } from '@repo/db';
import { cashDifference, type ShiftSummary } from '@repo/pos-core';
import { cx, formatINR } from '@repo/ui';
import { differenceText } from '../lib/cash.ts';
import type { PaperWidth } from './print.ts';

const when = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});
const day = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function Row({ label, paise, sign }: { label: string; paise: number; sign?: '+' | '−' }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="num">
        {sign ? `${sign} ` : ''}
        {formatINR(paise, { decimals: 'always' })}
      </span>
    </div>
  );
}

/** The closed day on thermal paper, to keep in the drawer with the cash. */
export function DaySlip({
  shift,
  summary,
  orgName,
  outletName,
  deviceCode,
  width = 80,
}: {
  shift: StoredShift;
  summary: ShiftSummary;
  orgName: string;
  outletName: string;
  deviceCode: string;
  width?: PaperWidth;
}) {
  const counted = shift.close?.countedCashPaise ?? 0;
  const difference = cashDifference(counted, summary.expectedCashPaise);
  const rule = <div className="my-2 border-t border-dashed border-receipt-ink" />;
  return (
    <article
      aria-label="Day close slip"
      className={cx(
        'bg-receipt text-receipt-ink',
        width === 58
          ? 'w-[58mm] p-[3mm] text-[10.5px] leading-[1.35]'
          : 'w-[80mm] p-[4mm] text-[12px] leading-[1.4]',
      )}
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <header className="text-center">
        <p className="text-[1.2em] font-bold">{orgName}</p>
        <p>
          {outletName} · {deviceCode}
        </p>
        <p className="mt-1 font-bold tracking-wide uppercase">Day close</p>
        <p>{day.format(new Date(`${shift.open.businessDate}T00:00:00Z`))}</p>
      </header>
      {rule}
      <p>
        Opened {when.format(new Date(shift.open.openedAt))} by {shift.open.openedByName}
      </p>
      {shift.close ? (
        <p>
          Closed {when.format(new Date(shift.close.closedAt))} by {shift.close.closedByName}
        </p>
      ) : null}
      {rule}
      <Row label={`Sales (${summary.bills} bills)`} paise={summary.salesPaise} />
      <Row label="Cash" paise={summary.cashSalesPaise} />
      <Row label="UPI" paise={summary.upiSalesPaise} />
      <Row label="Card" paise={summary.cardSalesPaise} />
      {summary.voids > 0 ? (
        <Row label={`Voided (${summary.voids})`} paise={summary.voidPaise} />
      ) : null}
      {rule}
      <Row label="Opening cash" paise={shift.open.openingCashPaise} />
      <Row label="Cash sales" paise={summary.cashSalesPaise} sign="+" />
      {shift.movements.map((m) => (
        <Row key={m.id} label={m.reason} paise={m.amountPaise} sign={m.kind === 'in' ? '+' : '−'} />
      ))}
      <div className="my-1 border-t border-receipt-ink" />
      <Row label="Expected in drawer" paise={summary.expectedCashPaise} />
      <Row label="Counted" paise={counted} />
      <div className="mt-1 flex justify-between font-bold">
        <span>Difference</span>
        <span className="num">{differenceText(difference)}</span>
      </div>
      {shift.close?.note ? <p className="mt-1">Note: {shift.close.note}</p> : null}
      {rule}
      <p className="mt-4">Signature ____________________</p>
    </article>
  );
}
