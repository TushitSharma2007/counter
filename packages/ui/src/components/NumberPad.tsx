import { Delete } from 'lucide-react';
import { useEffect } from 'react';
import { cx } from '../cx.ts';
import { applyPadKey, padKeyFromKeyboard, type PadKey } from '../logic/numpad.ts';
import { Icon } from './Icon.tsx';

export interface NumberPadProps {
  /** Digits typed so far. The caller decides what they mean (rupees, quantity, PIN). */
  value: string;
  onChange: (value: string) => void;
  /** What the pad is for, read out by screen readers ("Cash received"). */
  label: string;
  maxLength?: number;
  /** Show a "00" key (cash amounts). Off for PINs. */
  doubleZero?: boolean;
  /** Keep a leading 0 (PINs). Amounts drop it. */
  keepLeadingZeros?: boolean;
  /** Also listen to the physical keyboard (digits, Backspace, Enter). */
  captureKeyboard?: boolean;
  onEnter?: () => void;
  /** 'lg' for the PIN screen, where the pad is the whole task. */
  size?: 'md' | 'lg';
  className?: string;
}

const DIGITS: PadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function NumberPad({
  value,
  onChange,
  label,
  maxLength,
  doubleZero = false,
  keepLeadingZeros = false,
  captureKeyboard = false,
  onEnter,
  size = 'md',
  className,
}: NumberPadProps) {
  useEffect(() => {
    if (!captureKeyboard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'Enter') {
        onEnter?.();
        return;
      }
      const key = padKeyFromKeyboard(event.key);
      if (key) {
        event.preventDefault();
        onChange(applyPadKey(value, key, maxLength, keepLeadingZeros));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [captureKeyboard, value, onChange, maxLength, keepLeadingZeros, onEnter]);

  const press = (key: PadKey) => {
    onChange(applyPadKey(value, key, maxLength, keepLeadingZeros));
  };

  const keyClass = cx(
    'flex items-center justify-center bg-surface font-medium num select-none active:bg-sunken transition-colors duration-100',
    size === 'lg' ? 'h-[72px] text-2xl' : 'h-16 text-xl',
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line',
        className,
      )}
    >
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={keyClass}
          onClick={() => {
            press(digit);
          }}
        >
          {digit}
        </button>
      ))}
      {doubleZero ? (
        <button
          type="button"
          className={keyClass}
          onClick={() => {
            press('00');
          }}
        >
          00
        </button>
      ) : (
        <span aria-hidden className="bg-surface" />
      )}
      <button
        type="button"
        className={keyClass}
        onClick={() => {
          press('0');
        }}
      >
        0
      </button>
      <button
        type="button"
        aria-label="Delete"
        className={cx(keyClass, 'text-ink-2')}
        onClick={() => {
          press('back');
        }}
      >
        <Icon icon={Delete} size={24} />
      </button>
    </div>
  );
}
