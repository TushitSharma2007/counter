import { useRef } from 'react';

const HOLD_MS = 450;

/**
 * Tap for the common action, press and hold for the rarer one (e.g. add-ons), on touch and mouse.
 * Right-click also counts as a long press, for PCs.
 */
export function useLongPress(onTap: () => void, onLongPress?: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  const clear = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return {
    onPointerDown: () => {
      fired.current = false;
      if (!onLongPress) return;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, HOLD_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (!fired.current) onTap();
    },
    onContextMenu: (event: { preventDefault: () => void }) => {
      if (!onLongPress) return;
      event.preventDefault();
      clear();
      fired.current = true;
      onLongPress();
    },
  };
}
