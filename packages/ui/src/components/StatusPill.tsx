import type { ReactNode } from 'react';
import { cx } from '../cx.ts';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

const tones: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
  warning: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
  danger: { pill: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  neutral: { pill: 'bg-neutral-soft text-ink-2', dot: 'bg-ink-3' },
  accent: { pill: 'bg-accent-soft text-accent', dot: 'bg-accent' },
};

export interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

/** A state label: Paid, Pending, Void, Low stock, Preparing. Colour is for state only. */
export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span
      className={cx(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap',
        tones[tone].pill,
        className,
      )}
    >
      <span aria-hidden className={cx('size-1.5 rounded-full', tones[tone].dot)} />
      {children}
    </span>
  );
}
