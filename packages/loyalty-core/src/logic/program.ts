// A merchant's loyalty program: rules as data, stored as JSON on loyalty.programs.rules and
// validated here (docs/LOYALTY_SPEC.md §7). Merchants edit it through a form, never as JSON.
import { z } from 'zod';

const paise = z.number().int().nonnegative();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');

export const Reward = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('free_item'),
    name: z.string().min(1),
    itemId: z.string().optional(),
  }),
  z.object({ kind: z.literal('percent_off'), percent: z.number().int().min(1).max(100) }),
  z.object({ kind: z.literal('flat_off'), amountPaise: paise.min(100) }),
  z.object({ kind: z.literal('bogo'), name: z.string().min(1), itemId: z.string().optional() }),
]);
export type Reward = z.infer<typeof Reward>;

export const Tier = z.object({
  /** Stamps (stamp programs) or points (points programs) needed. */
  at: z.number().int().positive(),
  reward: Reward,
  validDays: z.number().int().positive().default(30),
  /** The card starts over after this tier; extra stamps carry over to the new card. */
  resetsCard: z.boolean().default(false),
});
export type Tier = z.infer<typeof Tier>;

export const HappyHour = z.object({
  /** 0 = Sunday … 6 = Saturday, in the merchant's local time. */
  days: z.array(z.number().int().min(0).max(6)).min(1),
  from: hhmm,
  to: hhmm,
  multiplier: z.number().int().min(2).max(5),
});
export type HappyHour = z.infer<typeof HappyHour>;

export const Program = z
  .object({
    type: z.enum(['stamps', 'points', 'hybrid']),
    tiers: z.array(Tier).min(1),
    earn: z
      .object({
        /** Self-stamping is always per visit; the POS can also stamp per qualifying item. */
        per: z.enum(['visit', 'item']).default('visit'),
        itemIds: z.array(z.string()).default([]),
        categoryIds: z.array(z.string()).default([]),
        /** Integrated mode: bills under this don't earn a stamp. */
        minBillPaise: paise.optional(),
        /** Points programs: points earned per ₹100 spent. */
        pointsPer100: z.number().int().positive().default(10),
      })
      .default({ per: 'visit', itemIds: [], categoryIds: [], pointsPer100: 10 }),
    limits: z
      .object({
        cooldownMinutes: z.number().int().nonnegative().default(120),
        /** Caps stamps (not visits) per customer per day, across all outlets. */
        maxPerDay: z.number().int().positive().default(2),
        /** Empty means every outlet takes part. */
        participatingOutletIds: z.array(z.string()).default([]),
      })
      .default({ cooldownMinutes: 120, maxPerDay: 2, participatingOutletIds: [] }),
    expiry: z
      .object({ stampsExpireAfterInactiveDays: z.number().int().positive().optional() })
      .default({}),
    bonuses: z
      .object({
        welcomeStamps: z.number().int().nonnegative().default(0),
        birthdayReward: Reward.optional(),
        happyHours: z.array(HappyHour).default([]),
        referralStamps: z.number().int().nonnegative().default(0),
      })
      .default({ welcomeStamps: 0, happyHours: [], referralStamps: 0 }),
    design: z
      .object({
        cardName: z.string().min(1).default('Loyalty card'),
        logoUrl: z.url().optional(),
        bgColor: z.string().default('#fffdf9'),
        inkColor: z.string().default('#2c4a7c'),
        stampIcon: z.enum(['cup', 'bean', 'leaf', 'star', 'logo']).default('cup'),
        slotsShape: z.enum(['circle', 'square']).default('circle'),
      })
      .default({
        cardName: 'Loyalty card',
        bgColor: '#fffdf9',
        inkColor: '#2c4a7c',
        stampIcon: 'cup',
        slotsShape: 'circle',
      }),
  })
  .superRefine((program, ctx) => {
    const ats = program.tiers.map((t) => t.at);
    if (ats.some((at, i) => i > 0 && at <= (ats[i - 1] ?? 0))) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: 'Tiers must go up: 5 stamps, then 10, …',
      });
    }
    if (program.tiers.slice(0, -1).some((t) => t.resetsCard)) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: 'Only the last tier can start a new card.',
      });
    }
  });
export type Program = z.infer<typeof Program>;
export type ProgramInput = z.input<typeof Program>;

/** What a merchant picks from when they start (LOYALTY_SPEC §7). */
export const TEMPLATES: Record<'classic' | 'tiers' | 'points', ProgramInput> = {
  classic: {
    type: 'stamps',
    tiers: [{ at: 9, reward: { kind: 'free_item', name: 'Cold Coffee' }, resetsCard: true }],
    design: { cardName: 'Coffee card' },
  },
  tiers: {
    type: 'stamps',
    tiers: [
      { at: 5, reward: { kind: 'free_item', name: 'Cookie' } },
      { at: 10, reward: { kind: 'free_item', name: 'Any coffee' }, resetsCard: true },
    ],
    design: { cardName: 'Regulars card' },
  },
  points: {
    type: 'points',
    earn: { pointsPer100: 10 },
    tiers: [{ at: 500, reward: { kind: 'flat_off', amountPaise: 10_000 }, resetsCard: true }],
    design: { cardName: 'Points card' },
  },
};
