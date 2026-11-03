import { CloudOff, RefreshCw } from 'lucide-react';
import { cx } from '../cx.ts';
import { syncLabel, type SyncState } from '../logic/sync.ts';
import { Icon } from './Icon.tsx';

export interface SyncIndicatorProps {
  state: SyncState;
  /** Bills waiting in the offline outbox. */
  queued?: number;
  className?: string;
}

export function SyncIndicator({ state, queued = 0, className }: SyncIndicatorProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cx(
        'inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap',
        state === 'offline' ? 'bg-warning-soft text-warning' : 'text-ink-2',
        className,
      )}
    >
      {state === 'live' ? (
        <span aria-hidden className="size-2 animate-pulse-ring rounded-full bg-success" />
      ) : (
        <Icon
          icon={state === 'syncing' ? RefreshCw : CloudOff}
          size={16}
          className={state === 'syncing' ? 'animate-spin' : undefined}
        />
      )}
      <span className="num">{syncLabel(state, queued)}</span>
    </span>
  );
}
