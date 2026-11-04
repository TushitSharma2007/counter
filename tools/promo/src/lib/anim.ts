import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// The product's own easing (tokens.css --ease-out), so the video moves like the app.
export const easeOut = Easing.bezier(0.2, 0.8, 0.2, 1);
export const easeIn = Easing.bezier(0.4, 0, 1, 1);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0 → 1 between two frames. */
export function useProgress(start: number, duration: number, easing = easeOut): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing });
}

/** A critically damped spring: settles without wobble. */
export function useSettle(delay = 0, stiffness = 140): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200, stiffness } });
}

export function lerp(t: number, from: number, to: number): number {
  return from + (to - from) * t;
}

/** Frames from seconds. */
export const s = (seconds: number) => Math.round(seconds * 30);
