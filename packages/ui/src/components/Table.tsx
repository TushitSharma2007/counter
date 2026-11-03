import type { ComponentProps } from 'react';
import { cx } from '../cx.ts';

/** Dense, hairline-ruled table for back-office screens. Scrolls sideways on narrow screens. */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full border-collapse text-left', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cx('border-b border-line-strong', className)} {...props} />;
}

export function TBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cx('border-b border-line last:border-0', className)} {...props} />;
}

interface CellProps {
  /** Right-aligned tabular figures, for prices, quantities and totals. */
  numeric?: boolean;
}

const cell = 'px-3 first:pl-0 last:pr-0';

export function Th({ numeric = false, className, ...props }: ComponentProps<'th'> & CellProps) {
  return (
    <th
      scope="col"
      className={cx(
        cell,
        'h-10 text-xs font-medium tracking-wide text-ink-2 uppercase',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ numeric = false, className, ...props }: ComponentProps<'td'> & CellProps) {
  return <td className={cx(cell, 'h-11', numeric && 'num text-right', className)} {...props} />;
}
