/** Product and domain names. Rename products here only. */
export const brand = {
  pos: { name: 'Counter' },
  loyalty: { name: 'Imprint' },
  /**
   * Origin used ONLY for NFC tag and QR links (`/s/…` and `/q/…`).
   * It is written into physical tags, so once real tags exist it must never change.
   * Placeholder until the short domain is bought (`.invalid` can never resolve).
   */
  stampLinkOrigin: 'https://stamp.invalid',
} as const;
