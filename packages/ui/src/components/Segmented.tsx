import type { ReactNode } from 'react';
import { cx } from '../cx.ts';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: 'md' | 'lg';
  className?: string;
}

/** One choice from a few, always visible: order type, payment mode. Big targets, no dropdown. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('grid gap-1 rounded-md bg-sunken p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => {
              onChange(option.value);
            }}
            className={cx(
              'flex items-center justify-center gap-1.5 rounded-sm px-2 font-medium whitespace-nowrap',
              'transition-colors duration-100 disabled:opacity-40',
              size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm',
              selected ? 'bg-ink font-semibold text-canvas' : 'text-ink active:bg-surface/70',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
