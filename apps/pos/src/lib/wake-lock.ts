import { useEffect } from 'react';

/** Keeps the screen awake while mounted (billing). Re-acquires when the tab becomes visible again. */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;
    let unmounted = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (unmounted) await sentinel.release();
      } catch {
        // Refused (e.g. battery saver). The screen may sleep; nothing else to do.
      }
    };

    const onVisibilityChange = () => void acquire();

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      unmounted = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release();
    };
  }, []);
}
