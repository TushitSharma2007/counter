import type { BillingContext } from '@repo/db';
import { computeBill, type OrderPayload } from '@repo/pos-core';
import { cx, formatINR } from '@repo/ui';
import type { PaperWidth } from './print.ts';

const when = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

const ORDER_TYPE: Record<OrderPayload['orderType'], string> = {
  counter: 'Counter',
  takeaway: 'Takeaway',
  dine_in: 'Dine-in',
  delivery: 'Delivery',
};

const PAID_BY: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  due: 'Khata (due)',
};

const money = (paise: number) => formatINR(paise, { decimals: 'always' });

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx('flex justify-between gap-2', strong && 'font-bold')}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

/** The bill as printed: tax invoice (regular GST) or bill of supply (composition scheme). */
export function Receipt({
  bill,
  context,
  voided,
  width = 80,
}: {
  bill: OrderPayload;
  context: BillingContext;
  voided?: { reason: string };
  width?: PaperWidth;
}) {
  const totals = computeBill(bill.lines, bill.tax);
  const composition = bill.tax.gstScheme === 'composition';
  const payment = bill.payments[0];
  const change = payment?.tenderedPaise ? payment.tenderedPaise - payment.amountPaise : 0;
  const address = [context.outlet.address, context.outlet.city].filter(Boolean).join(', ');

  return (
    <article
      aria-label={`Receipt ${bill.billNumber}`}
      className={cx(
        'bg-receipt text-receipt-ink',
        width === 58
          ? 'w-[58mm] p-[3mm] text-[10.5px] leading-[1.35]'
          : 'w-[80mm] p-[4mm] text-[12px] leading-[1.4]',
      )}
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <header className="text-center">
        <p className="text-[1.35em] font-bold">{context.org.name}</p>
        <p>{context.outlet.name}</p>
        {address ? <p>{address}</p> : null}
        {context.org.gstin ? <p className="num">GSTIN {context.org.gstin}</p> : null}
        <p className="mt-1 font-bold tracking-wide uppercase">
          {composition ? 'Bill of supply' : 'Tax invoice'}
        </p>
        {voided ? (
          <p className="mt-1 border-2 border-receipt-ink py-0.5 text-[1.2em] font-bold">VOID</p>
        ) : null}
      </header>

      <div className="my-2 border-t border-dashed border-receipt-ink" />
      <Row label="Bill" value={bill.billNumber} strong />
      <p>
        {when.format(new Date(bill.createdAt))} · {ORDER_TYPE[bill.orderType]}
      </p>
      <p>Billed by {bill.billedBy.name}</p>
      {bill.customerPhone ? <p className="num">Customer +91 {bill.customerPhone}</p> : null}

      <div className="my-2 border-t border-dashed border-receipt-ink" />
      <div className="flex justify-between font-bold">
        <span>Item</span>
        <span>Amount</span>
      </div>
      {bill.lines.map((line) => {
        const detail = [line.variantName, ...line.modifiers.map((m) => m.name)]
          .filter(Boolean)
          .join(', ');
        return (
          <div key={line.id} className="mt-1">
            <div className="flex justify-between gap-2">
              <span>
                {line.name}
                {line.qty > 1 ? ` × ${line.qty}` : ''}
              </span>
              <span className="num">{money(line.lineTotalPaise)}</span>
            </div>
            {detail || line.qty > 1 ? (
              <p className="pl-2 text-[0.9em]">
                {detail}
                {line.qty > 1 ? `${detail ? ' · ' : ''}${money(line.unitPaise)} each` : ''}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="my-2 border-t border-dashed border-receipt-ink" />
      <Row
        label={`Items (${bill.lines.reduce((s, l) => s + l.qty, 0)})`}
        value={money(totals.itemTotalPaise)}
      />
      {!composition ? (
        <>
          <Row label="Taxable value" value={money(totals.taxablePaise)} />
          {totals.taxGroups.map((g) => (
            <div key={g.rateBp}>
              <Row label={`CGST ${g.rateBp / 200}%`} value={money(g.cgstPaise)} />
              <Row label={`SGST ${g.rateBp / 200}%`} value={money(g.sgstPaise)} />
            </div>
          ))}
        </>
      ) : null}
      {totals.roundOffPaise !== 0 ? (
        <Row
          label="Round off"
          value={`${totals.roundOffPaise > 0 ? '+' : '−'}${money(Math.abs(totals.roundOffPaise))}`}
        />
      ) : null}
      <div className="my-1 border-t border-receipt-ink" />
      <Row label="Total" value={formatINR(totals.totalPaise)} strong />
      {payment ? (
        <p className="mt-1">
          Paid by {PAID_BY[payment.mode] ?? payment.mode}
          {payment.tenderedPaise
            ? ` · given ${formatINR(payment.tenderedPaise)}, change ${formatINR(change)}`
            : ''}
        </p>
      ) : null}
      {composition ? (
        <p className="mt-1 text-[0.9em]">
          Composition taxable person, not eligible to collect tax on supplies.
        </p>
      ) : null}
      {voided ? <p className="mt-1">Void: {voided.reason}</p> : null}

      <div className="my-2 border-t border-dashed border-receipt-ink" />
      <p className="text-center">Thank you! Visit again.</p>
    </article>
  );
}
