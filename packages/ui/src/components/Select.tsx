import { ChevronDown } from 'lucide-react';
import { useId, type ComponentProps } from 'react';
import { cx } from '../cx.ts';
import { Icon } from './Icon.tsx';

export interface SelectProps extends ComponentProps<'select'> {
  label: string;
  hideLabel?: boolean;
  options: { value: string; label: string }[];
  error?: string;
}

/** A native select (the phone's own picker), styled like Input. */
export function Select({
  label,
  hideLabel = false,
  options,
  error,
  className,
  id,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={selectId}
        className={cx('text-sm font-medium text-ink-2', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cx(
            'h-tap w-full appearance-none rounded-md border bg-surface pr-10 pl-3 text-base text-ink',
            'focus:outline-2 focus:outline-offset-1 focus:outline-accent',
            error ? 'border-danger' : 'border-line-strong',
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          icon={ChevronDown}
          size={18}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-2"
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
