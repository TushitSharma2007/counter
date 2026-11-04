import { cx } from '@repo/ui';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { Word } from '../timeline.ts';
import { easeOut, useProgress } from './anim.ts';

/** Logical canvas: phone-sized CSS pixels, zoomed to 1080 x 1920. Components keep real proportions. */
export const W = 432;
export const H = 768;
const ZOOM = 1080 / W;

export function Stage({
  dark = false,
  children,
  className,
}: {
  dark?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AbsoluteFill style={{ background: dark ? '#14110f' : '#f7f3ec' }}>
      <div
        data-theme={dark ? 'dark' : 'light'}
        className={cx('relative overflow-hidden bg-canvas text-ink', className)}
        style={{ width: W, height: H, zoom: ZOOM, fontFamily: 'var(--font-ui)' }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

/** Section marker, like a ledger column heading: product name, then what this part is. */
export function Chapter({
  product,
  title,
  delay = 0,
}: {
  product: string;
  title: string;
  delay?: number;
}) {
  const t = useProgress(delay, 14);
  const rule = useProgress(delay + 4, 18);
  return (
    <div className="absolute top-16 right-6 left-6" style={{ opacity: t }}>
      <div className="flex items-baseline justify-between text-[11px] font-medium tracking-[0.14em] text-ink-2 uppercase">
        <span>{product}</span>
        <span>{title}</span>
      </div>
      <div
        className="mt-2 h-px origin-left bg-line-strong"
        style={{ transform: `scaleX(${rule})` }}
      />
    </div>
  );
}

/** A hairline device outline. No gloss, no perspective: the product is the subject. */
export function Phone({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-[34px] border border-line-strong bg-canvas shadow-float',
        className,
      )}
      style={{ width: 300, height: 600, ...style }}
    >
      <div className="absolute top-2.5 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
      <div className="absolute inset-0 pt-10">{children}</div>
    </div>
  );
}

/** Where a finger touched: an ink dot that presses and fades. */
export function TapMark({ x, y, at }: { x: number; y: number; at: number }) {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > 14) return null;
  const scale = interpolate(local, [0, 4, 14], [0.6, 1, 1.5], { easing: easeOut });
  const opacity = interpolate(local, [0, 4, 14], [0.35, 0.3, 0], { extrapolateRight: 'clamp' });
  return (
    <span
      className="pointer-events-none absolute size-9 rounded-full bg-ink"
      style={{ left: x - 18, top: y - 18, transform: `scale(${scale})`, opacity }}
    />
  );
}

/** Scenes keep everything above this line; below it are the captions, then Reels' own UI. */
export const CONTENT_BOTTOM = 560;

/**
 * The spoken line as captions, each word inking in as it is said. Sits above the area
 * Reels covers with its own buttons.
 */
export function Captions({ words, dark = false }: { words: Word[]; dark?: boolean }) {
  const frame = useCurrentFrame();
  const now = frame / 30;
  return (
    <div
      data-theme={dark ? 'dark' : 'light'}
      className="absolute right-6 left-6 text-[19px] leading-[1.3] font-medium tracking-[-0.01em]"
      style={{ top: CONTENT_BOTTOM + 12, background: 'transparent' }}
    >
      {words.map((word, i) => {
        const spoken = now >= word.start;
        return (
          <span
            key={i}
            className={spoken ? 'text-ink' : 'text-ink-3'}
            style={{ opacity: spoken ? 1 : 0.55, transition: 'none' }}
          >
            {word.text}{' '}
          </span>
        );
      })}
    </div>
  );
}

/** Big display words that rise into place one by one, on the beat of the voiceover. */
export function Headline({
  words,
  className,
  startOffset = 0,
}: {
  words: { text: string; at: number }[];
  className?: string;
  startOffset?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <p className={cx('font-display font-medium tracking-[-0.02em]', className)}>
      {words.map((word, i) => {
        const t = interpolate(frame, [word.at + startOffset, word.at + startOffset + 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: easeOut,
        });
        return (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span
              className="inline-block"
              style={{ transform: `translateY(${(1 - t) * 100}%)`, opacity: t }}
            >
              {word.text}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          </span>
        );
      })}
    </p>
  );
}
