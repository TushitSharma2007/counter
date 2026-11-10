import { cx, formatINR } from '@repo/ui';
import type { ReactNode } from 'react';

/** One line of a ledger page: label on the left, amount on the right, hairline between lines. */
export function LedgerRow({
  label,
  detail,
  paise,
  sign,
  strong,
  tone,
}: {
  label: ReactNode;
  detail?: ReactNode;
  paise: number;
  /** Shown before the amount: money in (+) or out (−). */
  sign?: '+' | '−';
  strong?: boolean;
  tone?: 'success' | 'danger';
}) {
  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0',
        strong && 'font-semibold',
      )}
    >
      <div className="min-w-0">
        <p>{label}</p>
        {detail ? <p className="text-sm font-normal text-ink-2">{detail}</p> : null}
      </div>
      <span
        className={cx(
          'num shrink-0',
          strong && 'font-display text-lg',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
        )}
      >
        {sign ? `${sign} ` : ''}
        {formatINR(paise)}
      </span>
    </div>
  );
}
