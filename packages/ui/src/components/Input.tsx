import { CircleAlert } from 'lucide-react';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Icon } from './Icon.tsx';

export interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  label: string;
  /** Keep the label for screen readers but don't show it (e.g. a search field with a placeholder). */
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  /** Shown inside the field before the value, e.g. "₹" or a search icon. */
  prefix?: ReactNode;
  /** Tabular figures and a numeric keyboard, for amounts and quantities. */
  numeric?: boolean;
}

export function Input({
  label,
  hideLabel = false,
  hint,
  error,
  prefix,
  numeric = false,
  className,
  id,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={inputId}
        className={cx('text-sm font-medium text-ink-2', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <div
        className={cx(
          'flex h-tap items-center gap-2 rounded-md border bg-surface px-3',
          'focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent',
          error ? 'border-danger' : 'border-line-strong',
        )}
      >
        {prefix ? <span className="flex shrink-0 text-ink-2">{prefix}</span> : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          inputMode={numeric ? 'numeric' : undefined}
          className={cx(
            'h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3',
            numeric && 'num',
          )}
          {...props}
        />
      </div>
      {note ? (
        <p
          id={noteId}
          className={cx('flex items-center gap-1 text-sm', error ? 'text-danger' : 'text-ink-2')}
        >
          {error ? <Icon icon={CircleAlert} size={14} /> : null}
          {note}
        </p>
      ) : null}
    </div>
  );
}
