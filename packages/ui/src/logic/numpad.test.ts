import { describe, expect, it } from 'vitest';
import { applyPadKey, padKeyFromKeyboard } from './numpad.ts';

describe('applyPadKey', () => {
  it('appends digits', () => {
    expect(applyPadKey('5', '0')).toBe('50');
    expect(applyPadKey('5', '00')).toBe('500');
  });

  it('ignores leading zeros', () => {
    expect(applyPadKey('', '0')).toBe('');
    expect(applyPadKey('', '00')).toBe('');
  });

  it('keeps leading zeros for PINs', () => {
    expect(applyPadKey('', '0', 4, true)).toBe('0');
    expect(applyPadKey('0', '2', 4, true)).toBe('02');
  });

  it('deletes the last digit', () => {
    expect(applyPadKey('500', 'back')).toBe('50');
    expect(applyPadKey('', 'back')).toBe('');
  });

  it('stops at maxLength, including a 00 that would overflow', () => {
    expect(applyPadKey('1234', '5', 4)).toBe('1234');
    expect(applyPadKey('123', '00', 4)).toBe('123');
  });
});

describe('padKeyFromKeyboard', () => {
  it('maps digits and Backspace, ignores the rest', () => {
    expect(padKeyFromKeyboard('7')).toBe('7');
    expect(padKeyFromKeyboard('Backspace')).toBe('back');
    expect(padKeyFromKeyboard('a')).toBeUndefined();
    expect(padKeyFromKeyboard('Enter')).toBeUndefined();
  });
});
