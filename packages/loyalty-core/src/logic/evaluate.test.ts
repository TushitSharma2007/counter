import { describe, expect, it } from 'vitest';
import { evaluate, NEW_CARD, type CardState, type StampEvent } from './evaluate.ts';
import { Program, TEMPLATES, type ProgramInput } from './program.ts';

const ARC = 'arera-colony';
const MPN = 'mp-nagar';

// 10:00 am IST on Monday 9 November 2026 = 04:30 UTC.
const MON_10AM = '2026-11-09T04:30:00.000Z';
const minutesLater = (iso: string, m: number) =>
  new Date(Date.parse(iso) + m * 60_000).toISOString();
const daysLater = (iso: string, d: number) => minutesLater(iso, d * 24 * 60);

const program = (input: ProgramInput = TEMPLATES.classic) => Program.parse(input);
const card = (overrides: Partial<CardState> = {}): CardState => ({ ...NEW_CARD, ...overrides });
const tap = (at = MON_10AM, outletId = ARC): StampEvent => ({ at, outletId });

describe('templates', () => {
  it('all three starter templates are valid programs', () => {
    for (const template of Object.values(TEMPLATES))
      expect(() => Program.parse(template)).not.toThrow();
  });

  it('rejects tiers that go down, and a reset before the last tier', () => {
    expect(
      Program.safeParse({
        type: 'stamps',
        tiers: [
          { at: 10, reward: { kind: 'percent_off', percent: 10 } },
          { at: 5, reward: { kind: 'percent_off', percent: 5 } },
        ],
      }).success,
    ).toBe(false);
    expect(
      Program.safeParse({
        type: 'stamps',
        tiers: [
          { at: 5, reward: { kind: 'percent_off', percent: 5 }, resetsCard: true },
          { at: 10, reward: { kind: 'percent_off', percent: 10 } },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('evaluate: stamps', () => {
  it('adds one stamp per visit and says how many are left', () => {
    const result = evaluate(program(), card({ stamps: 3 }), tap());
    expect(result.stampsAdded).toBe(1);
    expect(result.next.stamps).toBe(4);
    expect(result.messages).toContain('5 more stamps for a free Cold Coffee');
  });

  it('unlocks a tier exactly at the threshold, not before', () => {
    const p = program(TEMPLATES.tiers);
    expect(evaluate(p, card({ stamps: 3 }), tap()).rewardsUnlocked).toEqual([]);
    const at5 = evaluate(p, card({ stamps: 4 }), tap());
    expect(at5.rewardsUnlocked).toHaveLength(1);
    expect(at5.rewardsUnlocked[0]?.reward).toEqual({ kind: 'free_item', name: 'Cookie' });
    expect(at5.rewardsUnlocked[0]?.expiresAt).toBe(daysLater(MON_10AM, 30));
  });

  it('starts a new card after the final tier', () => {
    const result = evaluate(program(), card({ stamps: 8 }), tap());
    expect(result.rewardsUnlocked.map((r) => r.reward)).toEqual([
      { kind: 'free_item', name: 'Cold Coffee' },
    ]);
    expect(result.next.stamps).toBe(0);
    expect(result.next.lifetimeStamps).toBe(1);
  });

  it('carries extra stamps over to the new card', () => {
    // Double stamps at 8 of 9: one fills the card, one starts the next.
    const doubles: ProgramInput = {
      ...TEMPLATES.classic,
      bonuses: { happyHours: [{ days: [1], from: '09:00', to: '11:00', multiplier: 2 }] },
    };
    const result = evaluate(program(doubles), card({ stamps: 8 }), tap());
    expect(result.stampsAdded).toBe(2);
    expect(result.rewardsUnlocked).toHaveLength(1);
    expect(result.next.stamps).toBe(1);
  });
});

describe('evaluate: limits', () => {
  it('refuses a second stamp at the same outlet inside the cooldown, and says when', () => {
    const last = { [ARC]: MON_10AM };
    const early = evaluate(
      program(),
      card({ lastStampAtByOutlet: last, stampsToday: 1 }),
      tap(minutesLater(MON_10AM, 119)),
    );
    expect(early.rejected?.code).toBe('cooldown');
    expect(early.rejected?.retryAt).toBe(minutesLater(MON_10AM, 120));
    expect(early.next).toEqual(card({ lastStampAtByOutlet: last, stampsToday: 1 }));
  });

  it('allows the stamp exactly when the cooldown ends', () => {
    const result = evaluate(
      program(),
      card({ lastStampAtByOutlet: { [ARC]: MON_10AM }, stampsToday: 1 }),
      tap(minutesLater(MON_10AM, 120)),
    );
    expect(result.rejected).toBeUndefined();
  });

  it('the cooldown is per outlet', () => {
    const result = evaluate(
      program(),
      card({ lastStampAtByOutlet: { [ARC]: MON_10AM }, stampsToday: 1 }),
      tap(minutesLater(MON_10AM, 5), MPN),
    );
    expect(result.stampsAdded).toBe(1);
  });

  it('caps stamps per day across outlets', () => {
    const result = evaluate(program(), card({ stampsToday: 2 }), tap(MON_10AM, MPN));
    expect(result.rejected?.code).toBe('daily_cap');
  });

  it('trims a multi-stamp event to what is left of the daily cap', () => {
    const triples: ProgramInput = {
      ...TEMPLATES.classic,
      bonuses: { happyHours: [{ days: [1], from: '09:00', to: '11:00', multiplier: 3 }] },
    };
    const result = evaluate(program(triples), card({ stampsToday: 1 }), tap());
    expect(result.stampsAdded).toBe(1);
    expect(result.next.stampsToday).toBe(2);
  });

  it('only participating outlets give stamps', () => {
    const p = program({ ...TEMPLATES.classic, limits: { participatingOutletIds: [ARC] } });
    expect(evaluate(p, card(), tap(MON_10AM, MPN)).rejected?.code).toBe('outlet');
    expect(evaluate(p, card(), tap(MON_10AM, ARC)).stampsAdded).toBe(1);
  });
});

describe('evaluate: bonuses and expiry', () => {
  it('doubles stamps during happy hours, local time, and not outside them', () => {
    const p = program({
      ...TEMPLATES.classic,
      limits: { maxPerDay: 5 },
      bonuses: { happyHours: [{ days: [1], from: '15:00', to: '17:00', multiplier: 2 }] },
    });
    // 3:30 pm IST Monday = 10:00 UTC
    expect(evaluate(p, card(), tap('2026-11-09T10:00:00.000Z')).stampsAdded).toBe(2);
    expect(evaluate(p, card(), tap(MON_10AM)).stampsAdded).toBe(1);
    // Same time on Tuesday: not a happy hour day.
    expect(evaluate(p, card(), tap('2026-11-10T10:00:00.000Z')).stampsAdded).toBe(1);
  });

  it('gives the welcome stamp once, outside the daily cap', () => {
    const p = program({ ...TEMPLATES.classic, bonuses: { welcomeStamps: 1 } });
    const first = evaluate(p, card(), tap());
    expect(first.stampsAdded).toBe(2);
    expect(first.next.stampsToday).toBe(1);
    expect(first.next.welcomeGiven).toBe(true);
    const later = evaluate(p, first.next, tap(daysLater(MON_10AM, 1), ARC));
    expect(later.stampsAdded).toBe(1);
  });

  it('expires stamps after a long gap, then counts this visit on a fresh card', () => {
    const p = program({ ...TEMPLATES.classic, expiry: { stampsExpireAfterInactiveDays: 60 } });
    const old = card({ stamps: 6, lastStampAt: daysLater(MON_10AM, -61) });
    const result = evaluate(p, old, tap());
    expect(result.next.stamps).toBe(1);
    expect(result.messages[0]).toMatch(/expired/);
    // 59 days is fine.
    expect(
      evaluate(p, card({ stamps: 6, lastStampAt: daysLater(MON_10AM, -59) }), tap()).next.stamps,
    ).toBe(7);
  });

  it('gives the birthday reward once a year, on the day', () => {
    const p = program({
      ...TEMPLATES.classic,
      bonuses: { birthdayReward: { kind: 'free_item', name: 'Brownie' } },
    });
    const bday = card({ birthday: '11-09' });
    const result = evaluate(p, bday, tap());
    expect(result.rewardsUnlocked.map((r) => r.tierIndex)).toEqual(['birthday']);
    expect(evaluate(p, result.next, tap(minutesLater(MON_10AM, 300), MPN)).rewardsUnlocked).toEqual(
      [],
    );
    expect(evaluate(p, card({ birthday: '11-10' }), tap()).rewardsUnlocked).toEqual([]);
  });
});

describe('evaluate: integrated mode and points', () => {
  it('needs a minimum bill when the merchant sets one', () => {
    const p = program({ ...TEMPLATES.classic, earn: { minBillPaise: 10_000 } });
    expect(evaluate(p, card(), { ...tap(), billPaise: 9_900 }).rejected?.code).toBe('min_bill');
    expect(evaluate(p, card(), { ...tap(), billPaise: 10_000 }).stampsAdded).toBe(1);
  });

  it('can stamp per qualifying item, e.g. only coffees', () => {
    const p = program({
      ...TEMPLATES.classic,
      earn: { per: 'item', categoryIds: ['coffee'] },
      limits: { maxPerDay: 5 },
    });
    const items = [
      { itemId: 'cc', categoryId: 'coffee', qty: 2 },
      { itemId: 'vpf', categoryId: 'snacks', qty: 3 },
    ];
    expect(evaluate(p, card(), { ...tap(), items }).stampsAdded).toBe(2);
    expect(
      evaluate(p, card(), { ...tap(), items: [{ itemId: 'vpf', categoryId: 'snacks', qty: 1 }] })
        .rejected?.code,
    ).toBe('no_qualifying_items');
  });

  it('earns points from spend and unlocks the points reward with carry-over', () => {
    const p = program(TEMPLATES.points);
    const result = evaluate(p, card({ points: 480 }), { ...tap(), billPaise: 39_600 });
    expect(result.pointsAdded).toBe(39);
    expect(result.rewardsUnlocked.map((r) => r.reward)).toEqual([
      { kind: 'flat_off', amountPaise: 10_000 },
    ]);
    expect(result.next.points).toBe(19);
    expect(result.stampsAdded).toBe(0);
  });
});
