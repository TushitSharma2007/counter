// Counter (POS) scenes: rush hour offline, billing, kitchen, owner dashboard, day close, staff PINs.
// Built from @repo/ui so the video shows the product's real components and tokens.
import { cx, formatINR, PriceTag, StatusPill, SyncIndicator } from '@repo/ui';
import { Check, Lock } from 'lucide-react';
import { interpolate, useCurrentFrame } from 'remotion';
import { easeOut, lerp, useProgress, useSettle } from '../lib/anim.ts';
import { Chapter, Phone, TapMark } from '../lib/ui.tsx';
import type { Segment } from '../timeline.ts';

/** Frame (within the scene) at which the nth spoken word starts. */
export const wordAt = (seg: Segment, index: number) =>
  Math.round((seg.words[Math.min(index, seg.words.length - 1)]?.start ?? 0) * 30);

// --- Hook: rush hour, then the internet drops ------------------------------------------------

const RUSH = [
  ['000231', 'Cold Coffee ×2', 29800],
  ['000232', 'Masala Chai ×3', 14700],
  ['000233', 'Hazelnut Latte, Veg Puff', 21800],
  ['000234', 'Iced Mocha', 18900],
  ['000235', 'Paneer Sandwich, Cold Coffee', 26800],
  ['000236', 'Masala Chai ×2, Veg Puff ×2', 17600],
  ['000237', 'Cappuccino ×2', 29800],
] as const;

export function HookScene({ seg }: { seg: Segment }) {
  const frame = useCurrentFrame();
  const drop = wordAt(seg, 7); // "...and the internet drops."
  const offline = frame >= drop;
  const shiver = offline
    ? Math.sin((frame - drop) * 1.9) * Math.max(0, 4 - (frame - drop) * 0.4)
    : 0;

  return (
    <>
      <Chapter product="Counter" title="Saturday, 1:42 pm" />
      <div className="absolute top-28 right-6 left-6 flex items-center justify-between">
        <p className="font-display text-[44px] leading-none font-medium tracking-[-0.03em]">
          <span className="num">{Math.min(12, Math.floor(frame / 4) + 1)}</span>
          <span className="ml-2 align-middle text-[17px] font-normal tracking-normal text-ink-2">
            orders waiting
          </span>
        </p>
        <span style={{ transform: `translateX(${shiver}px)` }}>
          <SyncIndicator state={offline ? 'offline' : 'live'} />
        </span>
      </div>

      <ul className="absolute top-48 right-6 left-6">
        {RUSH.map(([no, items, paise], i) => {
          const at = i * 5;
          const t = interpolate(frame, [at, at + 9], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: easeOut,
          });
          const stuck = offline && i >= 4;
          return (
            <li
              key={no}
              className="flex items-baseline gap-3 border-b border-line py-2.5"
              style={{
                opacity: t * (stuck ? 0.45 : 1),
                transform: `translateY(${(1 - t) * 14}px)`,
              }}
            >
              <span className="num w-[148px] shrink-0 text-[12px] text-ink-2">
                ARC-T1/2526/{no}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px]">{items}</span>
              <PriceTag paise={paise} size="sm" />
            </li>
          );
        })}
      </ul>
    </>
  );
}

// --- Billing: keeps going offline, syncs when back -------------------------------------------

const ITEMS = [
  ['Cold Coffee', 14900],
  ['Iced Mocha', 18900],
  ['Hazelnut Latte', 17900],
  ['Masala Chai', 4900],
  ['Veg Puff', 3900],
  ['Paneer Sandwich', 11900],
] as const;

export function BillingScene({ seg }: { seg: Segment }) {
  const frame = useCurrentFrame();
  const enter = useSettle(0);
  const taps = [6, 15, 24]; // Cold Coffee, Veg Puff, Masala Chai
  const tapped = [0, 4, 3];
  const count = taps.filter((t) => frame >= t).length;
  const total = tapped.slice(0, count).reduce((sum, i) => sum + (ITEMS[i]?.[1] ?? 0), 0);
  const payAt = 36;
  const paid = frame >= payAt + 4;
  const backOnline = wordAt(seg, 9); // "...the moment you're back online"
  const syncState = frame < backOnline ? 'offline' : frame < backOnline + 22 ? 'syncing' : 'live';
  const queued = frame < backOnline + 22 ? (paid ? 4 : 3) : 0;

  return (
    <>
      <Chapter product="Counter" title="Billing" />
      <div
        className="absolute top-[104px] left-1/2"
        style={{ transform: `translate(-50%, ${(1 - enter) * 40}px)`, opacity: enter }}
      >
        <Phone style={{ width: 316, height: 430 }}>
          <div className="flex items-center justify-between px-4 pb-2">
            <p className="font-display text-[15px] font-semibold">Arera Colony</p>
            <SyncIndicator state={syncState} queued={queued} className="!h-7 !px-2 !text-[11px]" />
          </div>
          <div className="flex gap-4 border-b border-line px-4 text-[13px] font-medium text-ink-2">
            {['Cold Coffee', 'Hot Coffee', 'Tea', 'Snacks'].map((c, i) => (
              <span key={c} className={cx('relative pb-2', i === 0 && 'text-ink')}>
                {c}
                {i === 0 ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />
                ) : null}
              </span>
            ))}
          </div>
          <div className="relative grid grid-cols-2 gap-2 p-3">
            {ITEMS.map(([name, price], i) => {
              const tapIndex = tapped.indexOf(i);
              const hit = tapIndex >= 0 && frame >= (taps[tapIndex] ?? 0);
              return (
                <div
                  key={name}
                  className={cx(
                    'relative flex h-[62px] flex-col justify-between rounded-md border px-2.5 py-2',
                    hit ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                  )}
                >
                  <span className="text-[12.5px] leading-tight font-medium">{name}</span>
                  <PriceTag paise={price} size="sm" className="text-ink-2" />
                  {hit ? (
                    <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-accent text-on-accent">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  ) : null}
                </div>
              );
            })}
            {taps.map((at, n) => {
              const i = tapped[n] ?? 0;
              return (
                <TapMark key={at} at={at} x={(i % 2) * 148 + 80} y={Math.floor(i / 2) * 70 + 42} />
              );
            })}
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-md bg-ink px-3 py-2.5 text-canvas">
            <span className="text-[12px] opacity-75">{count} items</span>
            <PriceTag paise={total} className="ml-auto text-[15px]" />
            <span
              className={cx(
                'rounded-sm px-3 py-1.5 text-[13px] font-semibold',
                paid ? 'bg-success text-canvas' : 'bg-accent text-on-accent',
              )}
              style={{
                transform: frame >= payAt && frame < payAt + 3 ? 'translateY(1px)' : undefined,
              }}
            >
              {paid ? 'Paid' : 'Pay'}
            </span>
          </div>
        </Phone>
      </div>
    </>
  );
}

// --- Kitchen display (night theme): New -> Preparing -> Ready ---------------------------------

const TICKETS = [
  { no: '231', type: 'Takeaway', items: ['2 × Cold Coffee', '1 × Veg Puff'] },
  { no: '232', type: 'Dine-in · T4', items: ['3 × Masala Chai'] },
  { no: '233', type: 'Counter', items: ['1 × Hazelnut Latte, oat milk', '1 × Veg Puff'] },
] as const;

const KDS_STATES = [
  { label: 'New', tone: 'accent' },
  { label: 'Preparing', tone: 'warning' },
  { label: 'Ready', tone: 'success' },
] as const;

export function KitchenScene() {
  const frame = useCurrentFrame();
  return (
    <>
      <Chapter product="Counter" title="Kitchen display" />
      <div className="absolute top-[108px] right-5 left-5 flex flex-col gap-2.5">
        {TICKETS.map((ticket, i) => {
          const arrive = i * 12;
          const t = interpolate(frame, [arrive, arrive + 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: easeOut,
          });
          const step = Math.min(2, Math.max(0, Math.floor((frame - arrive - 14) / 18)));
          const state = KDS_STATES[i === 2 ? Math.min(step, 0) : step] ?? KDS_STATES[0];
          return (
            <div
              key={ticket.no}
              className="rounded-lg border border-line bg-surface px-4 py-3"
              style={{ opacity: t, transform: `translateX(${(1 - t) * 60}px)` }}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-[26px] leading-none font-semibold">#{ticket.no}</p>
                <StatusPill tone={state.tone} className="!h-8 !text-[14px]">
                  {state.label}
                </StatusPill>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{ticket.type}</p>
              <ul className="mt-2 flex flex-col gap-0.5 text-[17px] font-medium">
                {ticket.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

// --- Owner dashboard: live sales across outlets ----------------------------------------------

const OUTLETS = [
  ['Arera Colony', 48_21_000],
  ['MP Nagar', 41_56_000],
  ['New Market', 34_81_000],
] as const;
const TODAY = OUTLETS.reduce((sum, [, paise]) => sum + paise, 0);
const HOURLY = [3, 5, 9, 14, 11, 8, 10, 16, 21, 18, 12];

export function DashboardScene() {
  const frame = useCurrentFrame();
  const count = useProgress(4, 34);
  const bars = useProgress(16, 26);
  const line = useProgress(20, 34);
  const ping = frame > 46 ? Math.max(0, 1 - (frame - 46) / 18) : 0;
  const live = frame > 46 ? 34_900 : 0; // a new bill lands at Arera Colony, live
  const shown = Math.round((TODAY * count) / 100) * 100;
  const max = Math.max(...HOURLY);
  const points = HOURLY.map(
    (v, i) => `${(i / (HOURLY.length - 1)) * 352},${64 - (v / max) * 58}`,
  ).join(' ');

  return (
    <>
      <Chapter product="Counter" title="Owner, on the go" />
      <div className="absolute top-[108px] right-6 left-6">
        <p className="flex items-center gap-2 text-[13px] text-ink-2">
          Today, all outlets
          <span
            className="size-1.5 rounded-full bg-success"
            style={{ boxShadow: `0 0 0 ${ping * 6}px rgb(47 107 63 / ${ping * 0.3})` }}
          />
        </p>
        <p className="num mt-1 font-display text-[54px] leading-none font-medium tracking-[-0.03em]">
          {formatINR(shown + live)}
        </p>

        <svg viewBox="0 0 352 70" className="mt-6 w-full overflow-visible">
          <polyline
            points={points}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - line}
          />
          <line x1="0" x2="352" y1="68" y2="68" stroke="var(--line-strong)" strokeWidth="1" />
        </svg>
        <p className="mt-1 flex justify-between text-[11px] text-ink-2">
          <span>8 am</span>
          <span>Orders per hour</span>
          <span>6 pm</span>
        </p>

        <ul className="mt-6">
          {OUTLETS.map(([name, paise]) => (
            <li key={name} className="border-b border-line py-3 last:border-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-medium">{name}</span>
                <PriceTag paise={paise + (name === 'Arera Colony' ? live : 0)} />
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${(paise / OUTLETS[0][1]) * 100 * bars}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// --- Day close: the report arrives on Telegram -----------------------------------------------

export function DayCloseScene() {
  const t = useSettle(6, 120);
  const lines = [
    ['Bills', '212'],
    ['Sales', formatINR(48_21_000)],
    ['Cash', formatINR(12_40_000)],
    ['UPI', formatINR(33_91_000)],
    ['Card', formatINR(1_90_000)],
  ];
  return (
    <>
      <Chapter product="Counter" title="Day close, 11:30 pm" />
      <div
        className="absolute top-[132px] right-6 left-6 flex gap-3"
        style={{ opacity: t, transform: `translateY(${lerp(t, 50, 0)}px)` }}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-display text-[17px] font-semibold text-canvas">
          C
        </span>
        <div className="min-w-0 flex-1 rounded-lg rounded-tl-sm border border-line bg-surface p-4 shadow-float">
          <p className="text-[12px] font-medium text-ink-2">Counter bot · now</p>
          <p className="mt-1 font-display text-[22px] font-semibold">Day closed</p>
          <p className="text-[14px] text-ink-2">Arera Colony · Saturday</p>
          <dl className="mt-3">
            {lines.map(([k, v], i) => (
              <div
                key={k}
                className={cx(
                  'flex justify-between border-t border-line py-1.5 text-[15px]',
                  i === 1 && 'font-semibold',
                )}
              >
                <dt className="text-ink-2">{k}</dt>
                <dd className="num">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-success">
            <Check size={14} strokeWidth={2.25} /> Counted cash matches
          </p>
        </div>
      </div>
    </>
  );
}

// --- Staff PIN: every bill has a name on it --------------------------------------------------

const STAFF = [
  ['Priya Sharma', 'Cashier', 'PS'],
  ['Rohan Mehta', 'Manager', 'RM'],
  ['Suresh Patel', 'Kitchen', 'SP'],
] as const;

export function StaffScene({ seg }: { seg: Segment }) {
  const frame = useCurrentFrame();
  const select = 8;
  const digits = [16, 21, 26, 31].filter((d) => frame >= d).length;
  const named = wordAt(seg, 9); // "...every bill has a name on it."
  const bill = useProgress(named - 4, 12);

  return (
    <>
      <Chapter product="Counter" title="Staff sign-in" />
      <div className="absolute top-[108px] right-6 left-6">
        <p className="text-[17px] font-semibold">Who&rsquo;s at the counter?</p>
        <div className="mt-3 flex flex-col gap-2">
          {STAFF.map(([name, role, initials], i) => {
            const on = i === 0 && frame >= select;
            return (
              <div
                key={name}
                className={cx(
                  'flex h-[60px] items-center gap-3 rounded-lg border px-3',
                  on ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                )}
              >
                <span className="grid size-10 place-items-center rounded-full bg-sunken font-display text-[15px] font-semibold text-ink-2">
                  {initials}
                </span>
                <span>
                  <span className="block text-[15px] font-medium">{name}</span>
                  <span className="block text-[12px] text-ink-2">{role}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Lock size={16} strokeWidth={1.75} className="text-ink-2" />
          {[0, 1, 2, 3].map((d) => (
            <span
              key={d}
              className={cx(
                'size-3.5 rounded-full border-2',
                d < digits ? 'border-ink bg-ink' : 'border-line-strong',
              )}
            />
          ))}
        </div>
        <div
          className="mt-6 flex items-baseline gap-3 border-y border-line py-3"
          style={{ opacity: bill, transform: `translateY(${(1 - bill) * 12}px)` }}
        >
          <span className="num text-[12px] text-ink-2">ARC-T1/2526/000245</span>
          <span className="flex-1 text-[14px]">by Priya Sharma</span>
          <PriceTag paise={29_800} size="sm" />
        </div>
      </div>
    </>
  );
}
