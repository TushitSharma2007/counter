import type { BillTotals, Cart, CartAction } from '@repo/pos-core';
import { Button, cx, formatINR, Icon, PriceTag, Segmented } from '@repo/ui';
import { Minus, PauseCircle, Phone, Plus, ReceiptText } from 'lucide-react';
import { ORDER_TYPES, PAYMENT_MODES } from './options.ts';

export interface BillPanelProps {
  cart: Cart;
  dispatch: (action: CartAction) => void;
  totals: BillTotals;
  count: number;
  onPay: () => void;
  onHold: () => void;
  /** Off inside the phone sheet, which already has a title. */
  showTitle?: boolean;
  className?: string;
}

/** The bill being built: who it's for, what's on it, what it comes to, how they're paying. */
export function BillPanel({
  cart,
  dispatch,
  totals,
  count,
  onPay,
  onHold,
  showTitle = true,
  className,
}: BillPanelProps) {
  const empty = cart.lines.length === 0;
  const gst = totals.cgstPaise + totals.sgstPaise;

  return (
    <aside aria-label="Bill" className={cx('flex min-h-0 flex-col bg-surface', className)}>
      <div className="flex flex-col gap-3 border-b border-line px-4 pt-3 pb-3">
        <div className={cx('flex items-center justify-between', !showTitle && empty && 'hidden')}>
          {showTitle ? <h2 className="text-md font-semibold">New bill</h2> : <span />}
          {!empty ? (
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'clear' });
              }}
              className="h-9 rounded-md px-2 text-sm font-medium text-danger active:bg-danger-soft"
            >
              Clear bill
            </button>
          ) : null}
        </div>
        <Segmented
          label="Order type"
          value={cart.orderType}
          options={ORDER_TYPES}
          onChange={(value) => {
            dispatch({ type: 'orderType', value });
          }}
        />
        <label className="flex h-12 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
          <Icon icon={Phone} size={18} className="shrink-0 text-ink-2" />
          <span className="text-sm text-ink-2">+91</span>
          <span className="sr-only">Loyalty or customer phone number</span>
          <input
            value={cart.customerPhone}
            onChange={(event) => {
              dispatch({ type: 'customerPhone', value: event.target.value });
            }}
            inputMode="numeric"
            placeholder="Loyalty / customer number"
            className="num h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
          />
        </label>
      </div>

      <div className="grid grid-cols-[1fr_auto_4.5rem] gap-3 border-b border-line px-4 py-2 text-xs font-medium tracking-wide text-ink-2 uppercase">
        <span>Item</span>
        <span className="w-[8.5rem] text-center">Qty</span>
        <span className="text-right">Amount</span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <li className="flex flex-col items-center gap-2 px-6 py-12 text-center text-ink-2">
            <Icon icon={ReceiptText} size={28} className="text-ink-3" />
            <p>No items yet. Tap an item to start the bill.</p>
          </li>
        ) : null}
        {cart.lines.map((line) => {
          const detail = [line.variant?.name, ...line.modifiers.map((m) => m.name)]
            .filter(Boolean)
            .join(' · ');
          return (
            <li
              key={line.key}
              className="grid grid-cols-[1fr_auto_4.5rem] items-center gap-3 border-b border-line px-4 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{line.name}</p>
                <p className="truncate text-sm text-ink-2">
                  {detail}
                  {line.qty > 1 ? `${detail ? ' · ' : ''}${formatINR(line.unitPaise)} each` : ''}
                </p>
              </div>
              <div className="flex w-[8.5rem] items-center justify-between">
                <button
                  type="button"
                  aria-label={`One less ${line.name}`}
                  onClick={() => {
                    dispatch({ type: 'decrement', key: line.key });
                  }}
                  className="grid size-12 place-items-center rounded-md border border-line-strong active:bg-sunken"
                >
                  <Icon icon={Minus} size={18} />
                </button>
                <span className="num w-8 text-center text-md font-semibold">{line.qty}</span>
                <button
                  type="button"
                  aria-label={`One more ${line.name}`}
                  onClick={() => {
                    dispatch({ type: 'increment', key: line.key });
                  }}
                  className="grid size-12 place-items-center rounded-md border border-line-strong active:bg-sunken"
                >
                  <Icon icon={Plus} size={18} />
                </button>
              </div>
              <PriceTag paise={line.unitPaise * line.qty} className="justify-end" />
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line-strong px-4 pt-3 pb-4">
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">
              Items <span className="num">({count})</span>
            </dt>
            <dd className="num">{formatINR(totals.itemTotalPaise, { decimals: 'always' })}</dd>
          </div>
          {gst > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-2">Includes GST (CGST + SGST)</dt>
              <dd className="num text-ink-2">{formatINR(gst, { decimals: 'always' })}</dd>
            </div>
          ) : null}
          {totals.roundOffPaise !== 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-2">Round off</dt>
              <dd className="num text-ink-2">
                {totals.roundOffPaise > 0 ? '+' : '−'}
                {formatINR(Math.abs(totals.roundOffPaise), { decimals: 'always' })}
              </dd>
            </div>
          ) : null}
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
            <dt className="text-base font-semibold">Total</dt>
            <dd>
              <PriceTag
                paise={totals.totalPaise}
                size="lg"
                className="!text-[28px] font-semibold"
              />
            </dd>
          </div>
        </dl>

        <Segmented
          label="Payment mode"
          className="mt-3"
          value={cart.paymentMode === 'split' ? 'cash' : cart.paymentMode}
          options={PAYMENT_MODES}
          onChange={(value) => {
            dispatch({ type: 'paymentMode', value });
          }}
        />

        <div className="mt-3 flex gap-2">
          <Button size="lg" disabled={empty} onClick={onHold} className="px-4">
            <Icon icon={PauseCircle} size={18} />
            Hold
          </Button>
          <Button
            variant="accent"
            size="lg"
            disabled={empty}
            onClick={onPay}
            className="flex-1 text-lg"
          >
            Pay {formatINR(totals.totalPaise)}
          </Button>
        </div>
      </div>
    </aside>
  );
}
