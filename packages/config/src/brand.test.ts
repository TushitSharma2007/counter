import { describe, expect, it } from 'vitest';
import { brand } from './brand.ts';

describe('stampLinkOrigin', () => {
  it('is a bare https origin with no path', () => {
    const url = new URL(brand.stampLinkOrigin);
    expect(url.protocol).toBe('https:');
    expect(url.origin).toBe(brand.stampLinkOrigin);
  });

  it('leaves room for the longest basic tag URL on an NTAG213', () => {
    // NTAG213 user memory is 144 bytes. NDEF overhead: TLV (2) + record header (4)
    // + URI prefix code (1, replaces "https://") + terminator TLV (1) = 8 bytes.
    const host = new URL(brand.stampLinkOrigin).host;
    const stampPointId = '0'.repeat(36); // UUID
    const token = '0'.repeat(22); // 128-bit token, base64url
    const mirror = `${'0'.repeat(14)}x${'0'.repeat(6)}`; // UID x counter
    const url = `${host}/s/${stampPointId}?t=${token}&m=${mirror}`;
    expect(url.length + 8).toBeLessThanOrEqual(144);
  });
});
