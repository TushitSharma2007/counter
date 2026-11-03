export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'back';

/** Applies one number-pad key to a digit string (cash tendered, quantity, PIN). */
export function applyPadKey(value: string, key: PadKey, maxLength = 9): string {
  if (key === 'back') return value.slice(0, -1);
  if (value === '' && (key === '0' || key === '00')) return value; // no leading zeros
  const next = value + key;
  return next.length > maxLength ? value : next;
}

const DIGIT = /^[0-9]$/;

/** Maps a keyboard key to a pad key, so the pad works with a PC keyboard too. */
export function padKeyFromKeyboard(key: string): PadKey | undefined {
  if (key === 'Backspace') return 'back';
  return DIGIT.test(key) ? (key as PadKey) : undefined;
}
