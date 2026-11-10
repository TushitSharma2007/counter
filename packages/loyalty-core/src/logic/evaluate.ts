// The loyalty rules engine (docs/LOYALTY_SPEC.md §7). Pure: no I/O, no clock, no randomness.
// The caller loads the card, passes the event, and saves what comes back in one transaction.
import type { HappyHour, Program, Reward, Tier } from './program.ts';

/** Merchant local time. India has one zone and no daylight saving. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CardState {
  stamps: number;
  points: number;
  lifetimeStamps: number;
  /** Last approved stamp at any outlet (ISO). Used for expiry. */
  lastStampAt?: string;
  /** Last approved stamp per outlet (ISO). Used for the cooldown. */
  lastStampAtByOutlet: Record<string, string>;
  /** Stamps already given today (merchant local day), across all outlets. */
  stampsToday: number;
  welcomeGiven: boolean;
  /** 'MM-DD', if the customer shared it. */
  birthday?: string;
  lastBirthdayRewardYear?: number;
}

export const NEW_CARD: CardState = {
  stamps: 0,
  points: 0,
  lifetimeStamps: 0,
  lastStampAtByOutlet: {},
  stampsToday: 0,
  welcomeGiven: false,
};

export interface StampEvent {
  /** When the tap, scan or bill happened (ISO). */
  at: string;
  outletId: string;
  /** Integrated mode: the bill total, if there is one. */
  billPaise?: number;
  /** Integrated mode: what was bought, for item-based earning. */
  items?: { itemId: string; categoryId?: string; qty: number }[];
}

export interface RewardGrant {
  tierIndex: number | 'birthday';
  reward: Reward;
  expiresAt: string;
}

export type RejectCode = 'outlet' | 'cooldown' | 'daily_cap' | 'min_bill' | 'no_qualifying_items';

export interface Evaluation {
  stampsAdded: number;
  pointsAdded: number;
  rewardsUnlocked: RewardGrant[];
  /** The card after this event. Unchanged when rejected. */
  next: CardState;
  /** Short, friendly lines for the customer's screen. */
  messages: string[];
  rejected?: { code: RejectCode; message: string; retryAt?: string };
}

// --- time helpers ------------------------------------------------------------------------------

function local(iso: string): Date {
  return new Date(Date.parse(iso) + IST_OFFSET_MS);
}

function minutesOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function happyHourMultiplier(hours: HappyHour[], at: string): number {
  const d = local(at);
  const now = minutesOfDay(d);
  let best = 1;
  for (const h of hours) {
    if (!h.days.includes(d.getUTCDay())) continue;
    const from = toMinutes(h.from);
    const to = toMinutes(h.to);
    const inside = from <= to ? now >= from && now < to : now >= from || now < to; // wraps midnight
    if (inside) best = Math.max(best, h.multiplier);
  }
  return best;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

// --- copy ----------------------------------------------------------------------------------------

function rewardName(reward: Reward): string {
  switch (reward.kind) {
    case 'free_item':
      return `a free ${reward.name}`;
    case 'bogo':
      return `buy one get one ${reward.name}`;
    case 'percent_off':
      return `${reward.percent}% off`;
    case 'flat_off':
      return `₹${Math.round(reward.amountPaise / 100)} off`;
  }
}

function progressLine(program: Program, card: CardState): string | undefined {
  const value = program.type === 'points' ? card.points : card.stamps;
  const next = program.tiers.find((t) => t.at > value);
  if (!next) return undefined;
  const left = next.at - value;
  const unit =
    program.type === 'points' ? (left === 1 ? 'point' : 'points') : left === 1 ? 'stamp' : 'stamps';
  return `${left} more ${unit} for ${rewardName(next.reward)}`;
}

// --- tiers ---------------------------------------------------------------------------------------

/**
 * Moves a counter (stamps or points) up by `add`, one step at a time, unlocking every tier it
 * reaches. Reaching a tier that resets the card starts a new card; the rest carries over.
 */
function climb(
  tiers: Tier[],
  start: number,
  add: number,
  at: string,
): { value: number; grants: RewardGrant[] } {
  let value = start;
  const grants: RewardGrant[] = [];
  for (let i = 0; i < add; i++) {
    value += 1;
    tiers.forEach((tier, index) => {
      if (value === tier.at) {
        grants.push({
          tierIndex: index,
          reward: tier.reward,
          expiresAt: addDays(at, tier.validDays),
        });
      }
    });
    const last = tiers.at(-1);
    if (last?.resetsCard && value >= last.at) value = 0;
  }
  return { value, grants };
}

// --- evaluate ----------------------------------------------------------------------------------

function reject(card: CardState, code: RejectCode, message: string, retryAt?: string): Evaluation {
  return {
    stampsAdded: 0,
    pointsAdded: 0,
    rewardsUnlocked: [],
    next: card,
    messages: [message],
    rejected: { code, message, ...(retryAt ? { retryAt } : {}) },
  };
}

export function evaluate(program: Program, cardIn: CardState, event: StampEvent): Evaluation {
  const { limits, earn, bonuses, expiry } = program;
  const messages: string[] = [];
  let card = cardIn;

  // 1. Only participating outlets.
  if (
    limits.participatingOutletIds.length > 0 &&
    !limits.participatingOutletIds.includes(event.outletId)
  ) {
    return reject(card, 'outlet', 'This outlet isn’t part of the card yet.');
  }

  // 2. Old stamps expire after a long gap.
  const inactiveDays = expiry.stampsExpireAfterInactiveDays;
  if (
    inactiveDays &&
    card.lastStampAt &&
    Date.parse(event.at) - Date.parse(card.lastStampAt) > inactiveDays * DAY_MS
  ) {
    if (card.stamps > 0) messages.push('Your earlier stamps expired, so this is a fresh card.');
    card = { ...card, stamps: 0 };
  }

  // 3. One stamp per outlet per cooldown.
  const lastHere = card.lastStampAtByOutlet[event.outletId];
  if (lastHere && limits.cooldownMinutes > 0) {
    const ready = Date.parse(lastHere) + limits.cooldownMinutes * 60_000;
    if (Date.parse(event.at) < ready) {
      const hours =
        limits.cooldownMinutes >= 60
          ? `${Math.round(limits.cooldownMinutes / 60)} hours`
          : `${limits.cooldownMinutes} minutes`;
      return reject(
        cardIn,
        'cooldown',
        `You’ve already collected a stamp here in the last ${hours}. Come back later!`,
        new Date(ready).toISOString(),
      );
    }
  }

  // 4. What this visit earns.
  if (
    earn.minBillPaise !== undefined &&
    event.billPaise !== undefined &&
    event.billPaise < earn.minBillPaise
  ) {
    return reject(
      cardIn,
      'min_bill',
      `Bills of ₹${Math.round(earn.minBillPaise / 100)} or more earn a stamp.`,
    );
  }

  let base = 1;
  if (earn.per === 'item' && event.items) {
    const qualifies = (i: { itemId: string; categoryId?: string }) =>
      (earn.itemIds.length === 0 && earn.categoryIds.length === 0) ||
      earn.itemIds.includes(i.itemId) ||
      (i.categoryId !== undefined && earn.categoryIds.includes(i.categoryId));
    base = event.items.filter(qualifies).reduce((sum, i) => sum + i.qty, 0);
    if (base === 0)
      return reject(cardIn, 'no_qualifying_items', 'Nothing on this bill earns a stamp.');
  }

  const earnsStamps = program.type !== 'points';
  let stamps = 0;
  let welcome = 0;
  if (earnsStamps) {
    stamps = base * happyHourMultiplier(bonuses.happyHours, event.at);

    // 5. The daily cap counts stamps across all outlets; a multi-stamp event is trimmed to fit.
    const room = limits.maxPerDay - card.stampsToday;
    if (room <= 0) {
      return reject(cardIn, 'daily_cap', 'That’s all the stamps for today. Come back tomorrow!');
    }
    stamps = Math.min(stamps, room);

    // 6. A one-time welcome gift, outside the daily cap.
    if (!card.welcomeGiven && bonuses.welcomeStamps > 0) welcome = bonuses.welcomeStamps;
  }

  // 7. Points from spend.
  const pointsAdded =
    program.type !== 'stamps' && event.billPaise !== undefined
      ? Math.floor((event.billPaise * earn.pointsPer100) / 10_000)
      : 0;

  // 8. Climb the tiers.
  const rewards: RewardGrant[] = [];
  let nextStamps = card.stamps;
  let nextPoints = card.points + pointsAdded;
  if (program.type === 'points') {
    const climbed = climb(program.tiers, card.points, pointsAdded, event.at);
    nextPoints = climbed.value;
    rewards.push(...climbed.grants);
  } else {
    const climbed = climb(program.tiers, card.stamps, stamps + welcome, event.at);
    nextStamps = climbed.value;
    rewards.push(...climbed.grants);
  }

  // 9. Birthday reward, once a year, on any visit that day.
  const today = local(event.at);
  const mmdd = `${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  let lastBirthdayRewardYear = card.lastBirthdayRewardYear;
  if (
    bonuses.birthdayReward &&
    card.birthday === mmdd &&
    card.lastBirthdayRewardYear !== today.getUTCFullYear()
  ) {
    rewards.push({
      tierIndex: 'birthday',
      reward: bonuses.birthdayReward,
      expiresAt: addDays(event.at, 7),
    });
    lastBirthdayRewardYear = today.getUTCFullYear();
    messages.push('Happy birthday! A treat is waiting on your card.');
  }

  const stampsAdded = stamps + welcome;
  const next: CardState = {
    ...card,
    stamps: nextStamps,
    points: nextPoints,
    lifetimeStamps: card.lifetimeStamps + stampsAdded,
    lastStampAt: event.at,
    lastStampAtByOutlet: { ...card.lastStampAtByOutlet, [event.outletId]: event.at },
    stampsToday: card.stampsToday + stamps,
    welcomeGiven: card.welcomeGiven || welcome > 0,
    ...(lastBirthdayRewardYear !== undefined ? { lastBirthdayRewardYear } : {}),
  };

  if (welcome > 0)
    messages.push(`Welcome! ${welcome} bonus ${welcome === 1 ? 'stamp' : 'stamps'} to start.`);
  for (const grant of rewards.filter((r) => r.tierIndex !== 'birthday')) {
    messages.push(`You’ve earned ${rewardName(grant.reward)}! Show it at the counter.`);
  }
  const progress = progressLine(program, next);
  if (progress) messages.push(progress);

  return { stampsAdded, pointsAdded, rewardsUnlocked: rewards, next, messages };
}
