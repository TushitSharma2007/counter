import { createElement, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type PaperWidth = 58 | 80;

const PAPER_KEY = 'counter.paper-width';

export function savedPaperWidth(): PaperWidth {
  try {
    return localStorage.getItem(PAPER_KEY) === '58' ? 58 : 80;
  } catch {
    return 80;
  }
}

export function savePaperWidth(width: PaperWidth): void {
  localStorage.setItem(PAPER_KEY, String(width));
}

/**
 * Prints one receipt and nothing else: it renders into #print-root (the only thing visible when
 * printing, see styles.css), calls the browser's print, then cleans up.
 */
export function usePrint() {
  const [job, setJob] = useState<{ node: ReactNode; width: PaperWidth }>();

  useEffect(() => {
    if (!job) return;
    const done = () => {
      setJob(undefined);
    };
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => {
      window.print();
    }, 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [job]);

  const portal = job
    ? createPortal(
        createElement('div', { id: 'print-root', 'data-paper': job.width }, job.node),
        document.body,
      )
    : null;

  return {
    print: (node: ReactNode, width: PaperWidth) => {
      setJob({ node, width });
    },
    portal,
  };
}
