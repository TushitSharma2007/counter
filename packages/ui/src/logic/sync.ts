export type SyncState = 'live' | 'syncing' | 'offline';

/** The always-visible sync status copy (CLAUDE.md §7). */
export function syncLabel(state: SyncState, queued: number): string {
  const bills = `${queued} ${queued === 1 ? 'bill' : 'bills'}`;
  switch (state) {
    case 'live':
      return 'Live';
    case 'syncing':
      return queued > 0 ? `Syncing ${bills}…` : 'Syncing…';
    case 'offline':
      return queued > 0 ? `Offline – ${bills} queued` : 'Offline';
  }
}
