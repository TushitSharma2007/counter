import { cx } from '../cx.ts';
import { formatINR, type FormatInrOptions } from '../logic/money.ts';

export type PriceTagSize = 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<PriceTagSize, string> = {
  sm: 'text-sm',
  md: 'text-base font-medium',
  lg: 'font-display text-xl font-medium',
  xl: 'font-display text-3xl font-medium tracking-tight',
};

export interface PriceTagProps extends FormatInrOptions {
  paise: number;
  size?: PriceTagSize;
  /** The price before a discount, shown struck through. */
  wasPaise?: number;
  className?: string;
}

export function PriceTag({ paise, size = 'md', wasPaise, decimals, className }: PriceTagProps) {
  const options: FormatInrOptions = decimals ? { decimals } : {};
  return (
    <span className={cx('num inline-flex items-baseline gap-1.5 whitespace-nowrap', className)}>
      {wasPaise !== undefined ? (
        <s className="text-sm text-ink-3">
          <span className="sr-only">was </span>
          {formatINR(wasPaise, options)}
        </s>
      ) : null}
      <span className={sizes[size]}>{formatINR(paise, options)}</span>
    </span>
  );
}
