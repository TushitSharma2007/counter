// The counter tablet's cash drawer for the day: started, cash in/out, closed. Kept in the outbox
// (works offline) and synced with bills.
import { serverOpenShift, type StoredShift } from '@repo/db';
import {
  cashMovement,
  closeShift,
  openShift,
  summariseShift,
  type CashMovement,
  type ShiftSummary,
} from '@repo/pos-core';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/db.ts';
import { outbox } from './sync.ts';

interface Who {
  membershipId: string | null;
  name: string;
}

export type Drawer =
  | { status: 'off' }
  | { status: 'loading' }
  | {
      status: 'none';
      /** What was counted at the last close, offered as today's opening cash. */
      lastCountedPaise?: number;
      start: (openingCashPaise: number) => Promise<void>;
    }
  | {
      status: 'open';
      shift: StoredShift;
      summary: ShiftSummary;
      move: (kind: CashMovement['kind'], amountPaise: number, reason: string) => Promise<void>;
      close: (
        countedCashPaise: number,
        note: string,
        onClosed: (day: { shift: StoredShift; summary: ShiftSummary }) => void,
      ) => Promise<void>;
      /** After a bill or a void. */
      refresh: () => void;
    };

export async function summaryFor(shift: StoredShift): Promise<ShiftSummary> {
  const bills = await outbox.shiftBills(shift.deviceId, shift.id);
  return summariseShift(
    shift.open,
    shift.movements,
    bills.map((b) => ({
      payments: b.payload.payments,
      totalPaise: b.payload.totals.totalPaise,
      voided: b.void !== undefined,
    })),
  );
}

export function useDrawer({
  enabled,
  deviceId,
  secret,
  by,
  dayCloseHour,
}: {
  /** Only counter tablets keep a drawer; owners' phones don't. */
  enabled: boolean;
  deviceId: string;
  secret?: string;
  by: Who;
  dayCloseHour?: number;
}): Drawer {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'none'; lastCountedPaise?: number }
    | { status: 'open'; shift: StoredShift; summary: ShiftSummary }
  >({ status: 'loading' });

  const show = useCallback(
    async (shift: StoredShift | undefined) => {
      if (shift) {
        setState({ status: 'open', shift, summary: await summaryFor(shift) });
        return;
      }
      const last = await outbox.lastClosedShift(deviceId);
      const counted = last?.close?.countedCashPaise;
      setState(
        counted === undefined ? { status: 'none' } : { status: 'none', lastCountedPaise: counted },
      );
    },
    [deviceId],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      let shift = await outbox.openShift(deviceId);
      // A tablet whose storage was wiped carries on with the day the server has.
      if (!shift && navigator.onLine) {
        const server = await serverOpenShift(db, deviceId, secret).catch(() => null);
        if (server) shift = await outbox.adoptShift(server.open, server.movements);
      }
      if (!cancelled) await show(shift);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, deviceId, secret, show]);

  if (!enabled) return { status: 'off' };
  if (state.status === 'loading') return state;
  if (state.status === 'none') {
    return {
      ...state,
      start: async (openingCashPaise) => {
        const open = openShift({
          deviceId,
          openingCashPaise,
          by,
          now: new Date().toISOString(),
          ...(dayCloseHour === undefined ? {} : { dayCloseHour }),
        });
        await show(await outbox.startShift(open));
      },
    };
  }

  const { shift, summary } = state;
  return {
    status: 'open',
    shift,
    summary,
    move: async (kind, amountPaise, reason) => {
      const movement = cashMovement({
        shiftId: shift.id,
        kind,
        amountPaise,
        reason,
        by,
        now: new Date().toISOString(),
      });
      await show(await outbox.addCashMovement(deviceId, movement));
    },
    close: async (countedCashPaise, note, onClosed) => {
      const fresh = await summaryFor(shift);
      const closed = await outbox.endShift(
        deviceId,
        closeShift({
          shiftId: shift.id,
          countedCashPaise,
          expectedCashPaise: fresh.expectedCashPaise,
          note,
          by,
          now: new Date().toISOString(),
        }),
      );
      // The closed day shows first, so the start screen doesn't flash up behind it.
      onClosed({ shift: closed, summary: fresh });
      await show(undefined);
    },
    refresh: () => {
      void show(shift);
    },
  };
}
