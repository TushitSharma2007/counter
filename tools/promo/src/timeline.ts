// Scene timing. Comes from the generated voiceover (pnpm voiceover writes vo.generated.json with
// real durations and word timestamps); falls back to an estimate from word count.
import generated from './vo.generated.json';
import { SCRIPT, type SegmentId } from './script.ts';

export const FPS = 30;
const GAP_S = 0.35; // breath between lines
const TAIL_S = 2.2; // hold the end card after the last word

export interface Word {
  text: string;
  start: number; // seconds from segment start
  end: number;
}

export interface Segment {
  id: SegmentId;
  text: string;
  from: number; // frames
  duration: number; // frames
  audio?: string; // path under public/
  words: Word[];
}

interface GeneratedSegment {
  id: string;
  duration: number;
  audio: string;
  words: Word[];
}

const fromVo = new Map(
  (generated as { segments: GeneratedSegment[] }).segments.map((s) => [s.id, s]),
);

function estimateWords(text: string): Word[] {
  const words = text.split(/\s+/);
  const perWord = 0.36;
  return words.map((w, i) => ({ text: w, start: i * perWord, end: (i + 1) * perWord - 0.04 }));
}

let cursor = 0;
export const SEGMENTS: Segment[] = SCRIPT.map(({ id, text }, index) => {
  const vo = fromVo.get(id);
  const words = vo?.words ?? estimateWords(text);
  const spoken = vo?.duration ?? words.at(-1)?.end ?? 1;
  const isLast = index === SCRIPT.length - 1;
  const duration = Math.round((spoken + (isLast ? TAIL_S : GAP_S)) * FPS);
  const segment: Segment = {
    id,
    text,
    from: cursor,
    duration,
    words,
    ...(vo ? { audio: vo.audio } : {}),
  };
  cursor += duration;
  return segment;
});

export const TOTAL_FRAMES = cursor;

export function segment(id: SegmentId): Segment {
  const found = SEGMENTS.find((s) => s.id === id);
  if (!found) throw new Error(`No segment ${id}`);
  return found;
}
