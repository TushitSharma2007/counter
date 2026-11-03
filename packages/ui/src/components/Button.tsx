import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cx } from '../cx.ts';
import { Icon } from './Icon.tsx';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-canvas active:bg-ink-2',
  accent: 'bg-accent text-on-accent active:bg-accent-pressed',
  secondary: 'bg-surface text-ink border border-line-strong active:bg-sunken',
  ghost: 'text-ink active:bg-sunken',
  danger: 'bg-surface text-danger border border-danger/40 active:bg-danger-soft',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 gap-1.5 text-sm', // back office only; POS screens use md or lg
  md: 'h-tap px-4 gap-2 text-base',
  lg: 'h-tap-lg px-5 gap-2 text-md',
};

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks presses while an action runs. */
  busy?: boolean;
  /** Render the child element (e.g. a router Link) with button styling. */
  asChild?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  asChild = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      type={asChild ? undefined : type}
      disabled={disabled === true || busy}
      aria-busy={busy || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium select-none',
        'transition-[background-color,transform] duration-100 ease-out active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {busy ? <Icon icon={LoaderCircle} size={18} className="animate-spin" /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}
