// The voiceover, one line per scene. Everything shown is in CLAUDE.md or docs/LOYALTY_SPEC.md:
// what we are building and will ship. No invented features, numbers or customer claims.
export const SCRIPT = [
  { id: 'hook', text: 'Saturday rush. Twelve orders deep, and the internet drops.' },
  {
    id: 'billing',
    text: 'Counter doesn\u2019t stop. Bills keep going, and sync the moment you\u2019re back online.',
  },
  { id: 'kitchen', text: 'Every order reaches the kitchen screen instantly.' },
  {
    id: 'dashboard',
    text: 'And wherever you are, every outlet\u2019s sales are live on your phone.',
  },
  { id: 'dayclose', text: 'At closing, the day\u2019s report lands on Telegram.' },
  { id: 'staff', text: 'Staff sign in with their own PIN, so every bill has a name on it.' },
  { id: 'pivot', text: 'Now, the part your regulars will love.' },
  { id: 'tap', text: 'No app to install. They tap their phone on the stamp at your counter,' },
  { id: 'stamp', text: 'and the stamp lands on their card.' },
  { id: 'secure', text: 'Every tap is signed, so a copied link can\u2019t be reused.' },
  { id: 'redeem', text: 'Free coffee earned? They show the code. You confirm it in one tap.' },
  { id: 'end', text: 'Counter and Imprint. Billing and loyalty, built for Indian caf\u00e9s.' },
] as const;

export type SegmentId = (typeof SCRIPT)[number]['id'];
