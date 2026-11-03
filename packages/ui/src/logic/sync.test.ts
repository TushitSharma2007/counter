import { describe, expect, it } from 'vitest';
import { syncLabel } from './sync.ts';

describe('syncLabel', () => {
  it('says Live when connected', () => {
    expect(syncLabel('live', 0)).toBe('Live');
  });

  it('counts queued bills while offline, with the right plural', () => {
    expect(syncLabel('offline', 0)).toBe('Offline');
    expect(syncLabel('offline', 1)).toBe('Offline – 1 bill queued');
    expect(syncLabel('offline', 3)).toBe('Offline – 3 bills queued');
  });

  it('shows progress while syncing', () => {
    expect(syncLabel('syncing', 0)).toBe('Syncing…');
    expect(syncLabel('syncing', 2)).toBe('Syncing 2 bills…');
  });
});
