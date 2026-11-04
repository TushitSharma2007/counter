import type { ComponentType } from 'react';
import { AbsoluteFill, Html5Audio, Sequence, staticFile } from 'remotion';
import { Captions, Stage } from './lib/ui.tsx';
import {
  BillingScene,
  DashboardScene,
  DayCloseScene,
  HookScene,
  KitchenScene,
  StaffScene,
} from './scenes/counter.tsx';
import {
  EndScene,
  PivotScene,
  RedeemScene,
  SecureScene,
  StampScene,
  TapScene,
} from './scenes/imprint.tsx';
import type { SegmentId } from './script.ts';
import { SEGMENTS, type Segment } from './timeline.ts';

const SCENES: Record<
  SegmentId,
  { scene: ComponentType<{ seg: Segment }>; dark?: boolean; captions?: boolean }
> = {
  hook: { scene: HookScene },
  billing: { scene: BillingScene },
  kitchen: { scene: KitchenScene, dark: true },
  dashboard: { scene: DashboardScene },
  dayclose: { scene: DayCloseScene },
  staff: { scene: StaffScene },
  pivot: { scene: PivotScene, captions: false }, // the headline is the line
  tap: { scene: TapScene },
  stamp: { scene: StampScene },
  secure: { scene: SecureScene },
  redeem: { scene: RedeemScene },
  end: { scene: EndScene, captions: false },
};

export function Promo() {
  return (
    <AbsoluteFill>
      {SEGMENTS.map((seg) => {
        const { scene: Scene, dark = false, captions = true } = SCENES[seg.id];
        return (
          <Sequence key={seg.id} from={seg.from} durationInFrames={seg.duration} name={seg.id}>
            <Stage dark={dark}>
              <Scene seg={seg} />
              {captions ? <Captions words={seg.words} dark={dark} /> : null}
            </Stage>
            {seg.audio ? <Html5Audio src={staticFile(seg.audio)} /> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
