import { useEffect, useState } from 'react';
import { Composition, continueRender, delayRender } from 'remotion';
import { Promo } from './Promo.tsx';
import { FPS, TOTAL_FRAMES } from './timeline.ts';
import './styles.css';

/** Hold rendering until Geist and Fraunces have loaded, so no frame uses a fallback font. */
function useFontsReady() {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    void Promise.all([
      document.fonts.load('400 16px "Geist Variable"'),
      document.fonts.load('600 16px "Fraunces Variable"'),
    ]).then(() => {
      continueRender(handle);
    });
  }, [handle]);
}

function FontGate() {
  useFontsReady();
  return <Promo />;
}

export function Root() {
  return (
    <Composition
      id="Promo"
      component={FontGate}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={TOTAL_FRAMES}
    />
  );
}
