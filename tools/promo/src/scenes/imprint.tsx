// Imprint (loyalty) scenes, following docs/LOYALTY_SPEC.md: tap the NFC stamp, no app, the ink
// stamp lands, signed single-use taps, redeem at the counter. Then the end card.
import { brand } from '@repo/config/brand';
import { cx, PriceTag, StatusPill } from '@repo/ui';
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { easeIn, easeOut, lerp, useProgress, useSettle } from '../lib/anim.ts';
import { Chapter, H, Headline, Phone, TapMark, W } from '../lib/ui.tsx';
import type { Segment } from '../timeline.ts';
import { wordAt } from './counter.tsx';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// --- The ink mark ------------------------------------------------------------------------------

/**
 * A rubber-stamp impression: ring, cup and a textured, slightly uneven edge. `spread` grows the
 * ink outward from the centre (0 → 1); `seed` varies the texture so no two marks match.
 */
export function InkMark({
  size,
  spread = 1,
  seed = 3,
  rotate = 0,
}: {
  size: number;
  spread?: number;
  seed?: number;
  rotate?: number;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <defs>
        <filter id={`rough-${id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={seed}
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" />
        </filter>
        <filter id={`grain-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed={seed + 7} />
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues="1 1 1 0.35 1 1 0" />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" operator="in" />
        </filter>
        <mask id={`spread-${id}`}>
          <circle cx="50" cy="50" r={spread * 56} fill="white" filter={`url(#rough-${id})`} />
        </mask>
      </defs>
      <g
        mask={`url(#spread-${id})`}
        filter={`url(#rough-${id})`}
        fill="none"
        stroke="var(--accent)"
        opacity={0.9}
      >
        <g filter={`url(#grain-${id})`}>
          <circle cx="50" cy="50" r="44" strokeWidth="5" />
          <circle cx="50" cy="50" r="36" strokeWidth="1.6" />
          {/* cup */}
          <path
            d="M33 42h28v12a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12z"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M61 46h4a6 6 0 0 1 0 12h-4" strokeWidth="4" />
          <path d="M40 30c0 3 3 3 3 6M48 30c0 3 3 3 3 6" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

/** The loyalty card as the customer sees it at /c/:merchantSlug. */
function Card({
  filled,
  stampSlot,
  count,
  note,
}: {
  filled: number;
  stampSlot?: { spread: number };
  count?: number;
  note?: { text: string; opacity: number };
}) {
  return (
    <div className="mx-4 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-ink-2 uppercase">
            Demo Coffee Co.
          </p>
          <p className="font-display text-[22px] font-semibold">Coffee card</p>
        </div>
        {count !== undefined ? (
          <p className="num font-display text-[30px] leading-none font-semibold">
            {count}
            <span className="ml-1 text-[16px] font-normal text-ink-2">of 9</span>
          </p>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="grid aspect-square place-items-center rounded-full border border-dashed border-line-strong"
          >
            {i < filled ? (
              <InkMark size={62} seed={i * 5 + 1} rotate={((i * 37) % 24) - 12} />
            ) : null}
            {stampSlot && i === filled ? (
              <InkMark size={62} seed={41} rotate={-6} spread={stampSlot.spread} />
            ) : null}
          </div>
        ))}
      </div>
      {note ? (
        <p className="mt-3 text-[15px] text-ink-2" style={{ opacity: note.opacity }}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}

// --- Pivot ---------------------------------------------------------------------------------------

export function PivotScene({ seg }: { seg: Segment }) {
  const frame = useCurrentFrame();
  const words = seg.text.split(' ').map((text, i) => ({ text, at: wordAt(seg, i) }));
  return (
    <>
      <Chapter product={brand.loyalty.name} title="Loyalty" />
      <div
        className="absolute -right-24 top-[300px] opacity-[0.14]"
        style={{ transform: `rotate(${frame * 0.4}deg)` }}
      >
        <InkMark size={320} seed={9} />
      </div>
      <Headline
        words={words}
        className="absolute top-[170px] right-6 left-6 text-[44px] leading-[1.05]"
      />
    </>
  );
}

// --- Tap: no app, the phone opens the card ------------------------------------------------------

/** The physical stamp on the counter, seen from above: a wooden block with the NFC tag inside. */
function StampObject({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
      <defs>
        <path id="ring" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
      </defs>
      <circle cx="100" cy="100" r="98" fill="var(--sunken)" stroke="var(--line-strong)" />
      {[90, 82, 61].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--line)" />
      ))}
      <text
        fontSize="11"
        letterSpacing="3.2"
        fill="var(--ink-2)"
        fontFamily="var(--font-ui)"
        fontWeight="600"
      >
        {/* textLength = the ring's circumference (2π × 74), so the words meet exactly once */}
        <textPath href="#ring" textLength="462" lengthAdjust="spacing">
          DEMO COFFEE CO. · TAP YOUR PHONE HERE ·
        </textPath>
      </text>
      <g
        transform="translate(76 76)"
        stroke="var(--ink)"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 18h28v10a12 12 0 0 1-12 12h-4A12 12 0 0 1 6 28z" />
        <path d="M34 21h3a5 5 0 0 1 0 10h-3" />
        <path d="M14 6c0 3 3 3 3 6M22 6c0 3 3 3 3 6" />
      </g>
    </svg>
  );
}

export function TapScene({ seg }: { seg: Segment }) {
  const frame = useCurrentFrame();
  const tap = wordAt(seg, 7); // "...They tap their phone"
  const approach = interpolate(frame, [tap - 16, tap], [0, 1], { ...clamp, easing: easeOut });
  const lift = interpolate(frame, [tap + 8, tap + 22], [0, 1], { ...clamp, easing: easeIn });
  const ripple = frame - tap;
  const lit = interpolate(frame, [tap + 2, tap + 10], [0, 1], clamp);
  const label = useProgress(0, 14);

  return (
    <>
      <Chapter product={brand.loyalty.name} title="At the counter" />
      <p
        className="absolute top-[104px] left-6 font-display text-[30px] font-medium tracking-[-0.02em]"
        style={{ opacity: label }}
      >
        No app to install.
      </p>
      <div className="absolute top-[160px] left-1/2 -translate-x-1/2">
        <StampObject />
        {/* the phone's top edge (where the iPhone antenna is) meets the stamp's lower edge */}
        {ripple >= 0 && ripple < 24
          ? [0, 7].map((delay) => {
              const r = Math.max(0, ripple - delay);
              return (
                <span
                  key={delay}
                  className="absolute rounded-full border border-accent"
                  style={{
                    left: 100 - r * 4,
                    top: 182 - r * 4,
                    width: r * 8,
                    height: r * 8,
                    opacity: Math.max(0, 0.7 - r / 18),
                  }}
                />
              );
            })
          : null}
      </div>
      <div
        className="absolute"
        style={{
          left: W / 2 - 65,
          top: lerp(approach, H + 20, 330) + lift * 40,
          transform: `rotate(${lerp(approach, -10, -2)}deg)`,
        }}
      >
        <Phone style={{ width: 130, height: 230, borderRadius: 22 }}>
          <div style={{ opacity: lit, zoom: 0.42 }} className="pt-2">
            <Card filled={3} />
          </div>
        </Phone>
      </div>
    </>
  );
}

// --- The stamp lands ------------------------------------------------------------------------------

export function StampScene() {
  const frame = useCurrentFrame();
  // About 900 ms from drop to lift (CLAUDE.md §6.5).
  const dropStart = 8;
  const impact = 18;
  const liftEnd = 35;
  const drop = interpolate(frame, [dropStart, impact - 3, impact], [0, 1.03, 1], {
    ...clamp,
    easing: easeOut,
  });
  const lift = interpolate(frame, [impact + 8, liftEnd], [0, 1], { ...clamp, easing: easeIn });
  const squash =
    frame >= impact && frame < impact + 8
      ? 1 - 0.02 * Math.sin(((frame - impact) / 8) * Math.PI)
      : 1;
  const shiver = frame >= impact && frame < impact + 5 ? Math.sin((frame - impact) * 2.6) * 1.4 : 0;
  const spread = interpolate(frame, [impact, impact + 7], [0, 1], { ...clamp, easing: easeOut });
  const ticked = frame >= liftEnd + 2;
  const note = useProgress(liftEnd + 6, 12);

  // Centre of slot 4 (row 2, column 1), measured from the top-left of the card wrapper.
  const slot = { x: 70, y: 214 };
  const stampSize = 104;

  return (
    <>
      <Chapter product={brand.loyalty.name} title="Stamped" />
      <div
        className="absolute top-[96px] left-1/2"
        style={{ transform: `translate(calc(-50% + ${shiver}px), 0)` }}
      >
        <Phone style={{ width: 316, height: 440 }}>
          <div
            style={{ transform: `scaleY(${squash})`, transformOrigin: '50% 60%' }}
            className="relative pt-3"
          >
            <Card
              filled={3}
              count={ticked ? 4 : 3}
              stampSlot={frame >= impact ? { spread } : undefined}
              note={{ text: '5 more for a free Cold Coffee', opacity: note }}
            />
            {/* The counter stamp itself presses down onto slot 4, then lifts away. */}
            {frame >= dropStart && frame < liftEnd ? (
              <div
                className="absolute rounded-full"
                style={{
                  left: slot.x - stampSize / 2,
                  top: slot.y - stampSize / 2,
                  width: stampSize,
                  height: stampSize,
                  transform: `scale(${lerp(drop, 1.8, 1) + lift * 0.5})`,
                  opacity: (1 - lift) * Math.min(1, drop * 2.5),
                  boxShadow: `0 ${lerp(drop, 36, 3)}px ${lerp(drop, 44, 8)}px -10px rgb(30 25 22 / 0.5)`,
                }}
              >
                <StampObject size={stampSize} />
              </div>
            ) : null}
          </div>
        </Phone>
      </div>
    </>
  );
}

// --- Signed taps; copied links don't work ------------------------------------------------------

function hex(seed: number, length: number): string {
  let out = '';
  let x = seed * 9301 + 49297;
  for (let i = 0; i < length; i++) {
    x = (x * 9301 + 49297) % 233280;
    out += '0123456789ABCDEF'.charAt(Math.floor((x / 233280) * 16));
  }
  return out;
}

export function SecureScene({ seg }: { seg: Segment }) {
  const frame = useCurrentFrame();
  const copied = wordAt(seg, 6); // "...so a copied link"
  const taps = [0, 12, 24].filter((t) => frame >= t);
  const strike = useProgress(copied + 4, 10);
  const message = useSettle(copied + 10);

  return (
    <>
      <Chapter product={brand.loyalty.name} title="Every tap is signed" />
      <ul className="absolute top-[108px] right-6 left-6 flex flex-col gap-3">
        {taps.map((at, i) => {
          const local = frame - at;
          const settled = local > 8;
          const t = interpolate(local, [0, 8], [0, 1], { ...clamp, easing: easeOut });
          return (
            <li key={at} className="border-b border-line pb-3" style={{ opacity: t }}>
              <p className="text-[12px] text-ink-2">Tap {41 + i}</p>
              <p
                className="num mt-1 text-[13px] leading-snug break-all"
                style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}
              >
                <span className="text-ink-2">/s/c41f9a…?picc=</span>
                {settled ? hex(at + 7, 16) : hex(frame * 3 + at, 16)}
                <span className="text-ink-2">&amp;cmac=</span>
                {settled ? hex(at + 91, 8) : hex(frame * 5 + at, 8)}
              </p>
            </li>
          );
        })}
      </ul>

      <div
        className="absolute top-[388px] right-6 left-6"
        style={{ opacity: frame >= copied ? 1 : 0 }}
      >
        <p className="text-[12px] text-ink-2">Copied link, opened at home</p>
        <p
          className="relative mt-1 text-[13px] text-ink-2"
          style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}
        >
          /s/c41f9a…?picc={hex(7, 16)}
          <span
            className="absolute top-1/2 left-0 h-[1.5px] bg-danger"
            style={{ width: `${strike * 100}%` }}
          />
        </p>
        <div
          className="mt-4 flex gap-2.5 rounded-lg border border-line bg-surface p-3.5"
          style={{ opacity: message, transform: `translateY(${(1 - message) * 16}px)` }}
        >
          <CircleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[14px] leading-snug">
            This stamp was already collected. Tap the stamp at the counter for your next one.
          </p>
        </div>
      </div>
    </>
  );
}

// --- Redeem at the counter ----------------------------------------------------------------------

export function RedeemScene({ seg }: { seg: Segment }) {
  const frame = useCurrentFrame();
  const enter = useSettle(0);
  const confirm = wordAt(seg, 11); // "...in one tap."
  const bill = useSettle(confirm - 14);
  const done = frame >= confirm + 2;

  return (
    <>
      <Chapter product={brand.loyalty.name} title="Redeem" />
      <div
        className="absolute top-[104px] right-6 left-6"
        style={{ opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}
      >
        <p className="text-[13px] text-ink-2">Reward unlocked</p>
        <p className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em]">
          Free Cold Coffee
        </p>
        <p className="mt-4 text-[13px] text-ink-2">Show this to the cashier</p>
        <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[0.12em]">
          K7M2QX
        </p>
        <p className="num mt-2 text-[13px] text-ink-2">
          Valid for{' '}
          {Math.max(0, 299 - Math.floor(frame / 30)) >= 0
            ? `4:${String(59 - Math.floor(frame / 30)).padStart(2, '0')}`
            : ''}
        </p>
      </div>

      <div
        className="absolute right-4 left-4 rounded-lg border border-line bg-surface p-4 shadow-float"
        style={{ top: lerp(bill, 520, 330), opacity: bill }}
      >
        <p className="text-[12px] font-medium text-ink-2">Counter · Arera Colony · T1</p>
        <div className="mt-2 flex items-baseline justify-between border-b border-line py-2 text-[15px]">
          <span>Cold Coffee</span>
          <PriceTag paise={14_900} />
        </div>
        <div className="flex items-baseline justify-between border-b border-line py-2 text-[15px]">
          <span className="flex items-center gap-2">
            Reward K7M2QX
            {done ? (
              <StatusPill tone="success" className="!h-6 !text-[12px]">
                Redeemed
              </StatusPill>
            ) : null}
          </span>
          <span className="num text-success">−{'₹'}149</span>
        </div>
        <div className="relative mt-3">
          <span
            className={cx(
              'flex h-11 items-center justify-center rounded-md text-[15px] font-semibold',
              done ? 'bg-success text-canvas' : 'bg-accent text-on-accent',
            )}
          >
            {done ? 'Reward confirmed' : 'Confirm reward'}
          </span>
          <TapMark x={190} y={22} at={confirm} />
        </div>
      </div>
    </>
  );
}

// --- End card -----------------------------------------------------------------------------------

export function EndScene() {
  const a = useSettle(4);
  const b = useSettle(12);
  const rule = useProgress(18, 20);
  const line = useProgress(26, 16);
  return (
    <>
      <div className="absolute top-[200px] right-8 left-8">
        <p
          className="font-display text-[64px] leading-[0.95] font-semibold tracking-[-0.035em]"
          style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}
        >
          {brand.pos.name}
        </p>
        <p
          className="font-display text-[64px] leading-[0.95] font-semibold tracking-[-0.035em] text-accent"
          style={{ opacity: b, transform: `translateY(${(1 - b) * 24}px)` }}
        >
          {brand.loyalty.name}
        </p>
        <div
          className="mt-8 h-px origin-left bg-line-strong"
          style={{ transform: `scaleX(${rule})` }}
        />
        <p className="mt-4 text-[19px] leading-snug text-ink-2" style={{ opacity: line }}>
          Billing and loyalty, built for Indian cafés.
        </p>
      </div>
      <div className="absolute top-[150px] right-8" style={{ opacity: line * 0.9 }}>
        <InkMark size={74} seed={17} rotate={-10} />
      </div>
    </>
  );
}
