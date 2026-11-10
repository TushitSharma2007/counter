import { cx } from '../cx.ts';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Read by screen readers: "Cold Coffee available at Arera Colony". */
  label: string;
  /** Shown next to the switch; omit to show the switch alone. */
  text?: string;
  disabled?: boolean;
  className?: string;
}

/** On / off for one thing: available, on the menu. 48px tall touch target. */
export function Switch({ checked, onChange, label, text, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className={cx(
        'inline-flex h-12 items-center gap-2.5 text-sm font-medium disabled:opacity-40',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-100',
          checked ? 'bg-success' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'absolute top-1 left-1 size-5 rounded-full bg-surface shadow-[0_1px_2px_rgb(30_25_22/0.3)] transition-transform duration-100',
            checked && 'translate-x-5',
          )}
        />
      </span>
      {text ? <span className={checked ? 'text-ink' : 'text-ink-2'}>{text}</span> : null}
    </button>
  );
}
