// The device's outbox and the background sync that empties it (CLAUDE.md §7).
import { Outbox, serverLastBillSeq, syncOutbox } from '@repo/db';
import { financialYear } from '@repo/pos-core';
import type { SyncState } from '@repo/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../lib/db.ts';
import { useOnline } from '../lib/online.ts';

/** One outbox per browser; bills from every device registered here live in it, by device id. */
export const outbox = new Outbox();

const EVERY_MS = 20_000;

export interface SyncTarget {
  deviceId: string;
  /** A counter tablet's key; personal phones sync with the signed-in login. */
  secret?: string;
}

export interface SyncView {
  state: SyncState;
  queued: number;
  failed: number;
  /** Sync now (after a bill, or when someone taps the indicator). */
  kick: () => void;
}

export function useSync({ deviceId, secret }: SyncTarget): SyncView {
  const online = useOnline();
  const [counts, setCounts] = useState({ queued: 0, failed: 0 });
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    setCounts(await outbox.pending(deviceId));
  }, [deviceId]);

  const run = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    setSyncing(true);
    try {
      await syncOutbox(db, outbox, deviceId, secret);
    } catch {
      // Network or auth hiccup: the bills stay queued and we try again shortly.
    } finally {
      running.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [deviceId, secret, refresh]);

  // When billing opens online: make sure this device's numbers carry on from the server's.
  useEffect(() => {
    if (!online) return;
    const fy = financialYear(new Date().toISOString());
    serverLastBillSeq(db, deviceId, fy, secret)
      .then((last) => outbox.catchUpCounter(deviceId, fy, last))
      .catch(() => undefined);
  }, [online, deviceId, secret]);

  useEffect(() => {
    outbox.pending(deviceId).then(setCounts, () => undefined);
    if (online) void run();
    const id = window.setInterval(() => void run(), EVERY_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [online, run, deviceId]);

  return {
    state: !online ? 'offline' : syncing && counts.queued > 0 ? 'syncing' : 'live',
    queued: counts.queued,
    failed: counts.failed,
    kick: () => {
      void refresh().then(run);
    },
  };
}
