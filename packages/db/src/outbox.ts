// The offline outbox (CLAUDE.md §7). Every paid bill is written here first, numbered in the same
// IndexedDB transaction, then sent to the server in the background. Billing never waits for the
// network. A bill the server refuses is kept and marked for attention, never dropped.
import type { CashMovement, OrderPayload, ShiftClose, ShiftEvent, ShiftOpen } from '@repo/pos-core';
import { Dexie, type EntityTable } from 'dexie';
import type { Json } from '@repo/types';
import type { Db } from './client.ts';

export type SyncStatus = 'queued' | 'synced' | 'failed';

export interface VoidRequest {
  reason: string;
  approvedBy: string;
  approvedByName: string;
  at: string;
  status: SyncStatus;
  error?: string;
}

export interface StoredBill {
  id: string;
  deviceId: string;
  payload: OrderPayload;
  status: SyncStatus;
  attempts: number;
  error?: string;
  createdAt: string;
  syncedAt?: string;
  void?: VoidRequest;
}

/** A counter tablet's cash drawer for a day, as the tablet keeps it. */
export interface StoredShift {
  id: string;
  deviceId: string;
  open: ShiftOpen;
  movements: CashMovement[];
  close?: ShiftClose;
  /** 1 while open, 0 once closed (IndexedDB can't index booleans). */
  isOpen: 0 | 1;
}

/** One drawer entry for the server. Sent in the order they happened. */
export interface StoredShiftEvent {
  id: string;
  deviceId: string;
  shiftId: string;
  at: string;
  event: ShiftEvent;
  status: SyncStatus;
  error?: string;
}

interface Counter {
  /** `${deviceId}:${financialYear}` */
  key: string;
  last: number;
}

class OutboxDb extends Dexie {
  bills!: EntityTable<StoredBill, 'id'>;
  counters!: EntityTable<Counter, 'key'>;
  shifts!: EntityTable<StoredShift, 'id'>;
  shiftEvents!: EntityTable<StoredShiftEvent, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      bills: 'id, deviceId, status, createdAt',
      counters: 'key',
    });
    this.version(2).stores({
      shifts: 'id, [deviceId+isOpen]',
      shiftEvents: 'id, deviceId, at',
    });
  }
}

export class Outbox {
  readonly store: OutboxDb;

  constructor(name = 'counter-outbox') {
    this.store = new OutboxDb(name);
  }

  /**
   * Numbers a bill and queues it, in one transaction, so two quick bills can never share a
   * number. `build` gets the next number in this device's series.
   */
  async addBill(
    deviceId: string,
    financialYear: string,
    build: (seq: number) => OrderPayload,
  ): Promise<StoredBill> {
    return this.store.transaction('rw', this.store.bills, this.store.counters, async () => {
      const key = `${deviceId}:${financialYear}`;
      const last = (await this.store.counters.get(key))?.last ?? 0;
      const payload = build(last + 1);
      if (payload.billSeq !== last + 1) throw new Error('Bill built with the wrong number');
      await this.store.counters.put({ key, last: last + 1 });
      const bill: StoredBill = {
        id: payload.id,
        deviceId,
        payload,
        status: 'queued',
        attempts: 0,
        createdAt: payload.createdAt,
      };
      await this.store.bills.add(bill);
      return bill;
    });
  }

  /** After the server says where this device's series got to (e.g. storage was wiped). */
  async catchUpCounter(deviceId: string, financialYear: string, serverLast: number): Promise<void> {
    await this.store.transaction('rw', this.store.counters, async () => {
      const key = `${deviceId}:${financialYear}`;
      const last = (await this.store.counters.get(key))?.last ?? 0;
      if (serverLast > last) await this.store.counters.put({ key, last: serverLast });
    });
  }

  async requestVoid(billId: string, request: Omit<VoidRequest, 'status'>): Promise<void> {
    await this.store.bills.update(billId, { void: { ...request, status: 'queued' } });
  }

  async get(billId: string): Promise<StoredBill | undefined> {
    return this.store.bills.get(billId);
  }

  /** This device's bills, newest first. */
  async recent(deviceId: string, limit = 100): Promise<StoredBill[]> {
    return this.store.bills
      .where('deviceId')
      .equals(deviceId)
      .reverse()
      .sortBy('createdAt')
      .then((b) => b.slice(0, limit));
  }

  /** Bills, voids or drawer entries still to reach the server. */
  async pending(deviceId: string): Promise<{ queued: number; failed: number }> {
    const bills = await this.store.bills.where('deviceId').equals(deviceId).toArray();
    const events = await this.store.shiftEvents.where('deviceId').equals(deviceId).toArray();
    return {
      queued:
        bills.filter((b) => b.status === 'queued' || b.void?.status === 'queued').length +
        events.filter((e) => e.status === 'queued').length,
      failed:
        bills.filter((b) => b.status === 'failed' || b.void?.status === 'failed').length +
        events.filter((e) => e.status === 'failed').length,
    };
  }

  /** This tablet's open cash drawer, if the day has been started. */
  async openShift(deviceId: string): Promise<StoredShift | undefined> {
    return this.store.shifts.where({ deviceId, isOpen: 1 }).first();
  }

  /** The last day this tablet closed, e.g. to offer its counted cash as the next opening. */
  async lastClosedShift(deviceId: string): Promise<StoredShift | undefined> {
    const closed = await this.store.shifts.where({ deviceId, isOpen: 0 }).toArray();
    return closed.sort((a, b) => b.open.openedAt.localeCompare(a.open.openedAt))[0];
  }

  /** Bills made in a shift, oldest first. */
  async shiftBills(deviceId: string, shiftId: string): Promise<StoredBill[]> {
    const bills = await this.store.bills.where('deviceId').equals(deviceId).sortBy('createdAt');
    return bills.filter((b) => b.payload.shiftId === shiftId);
  }

  /** Starts the day. Refuses when this tablet already has a drawer open. */
  async startShift(open: ShiftOpen): Promise<StoredShift> {
    return this.store.transaction('rw', this.store.shifts, this.store.shiftEvents, async () => {
      if (await this.openShift(open.deviceId)) throw new Error('The day is already started');
      const shift: StoredShift = {
        id: open.id,
        deviceId: open.deviceId,
        open,
        movements: [],
        isOpen: 1,
      };
      await this.store.shifts.add(shift);
      await this.queueShiftEvent(open.deviceId, `${open.id}:open`, open.id, open.openedAt, {
        kind: 'open',
        shift: open,
      });
      return shift;
    });
  }

  async addCashMovement(deviceId: string, movement: CashMovement): Promise<StoredShift> {
    return this.store.transaction('rw', this.store.shifts, this.store.shiftEvents, async () => {
      const shift = await this.store.shifts.get(movement.shiftId);
      if (shift?.isOpen !== 1) throw new Error('No open day on this tablet');
      const next: StoredShift = { ...shift, movements: [...shift.movements, movement] };
      await this.store.shifts.put(next);
      await this.queueShiftEvent(deviceId, movement.id, shift.id, movement.at, {
        kind: 'cash',
        movement,
      });
      return next;
    });
  }

  async endShift(deviceId: string, close: ShiftClose): Promise<StoredShift> {
    return this.store.transaction('rw', this.store.shifts, this.store.shiftEvents, async () => {
      const shift = await this.store.shifts.get(close.shiftId);
      if (shift?.isOpen !== 1) throw new Error('No open day on this tablet');
      const closed: StoredShift = { ...shift, close, isOpen: 0 };
      await this.store.shifts.put(closed);
      await this.queueShiftEvent(deviceId, `${shift.id}:close`, shift.id, close.closedAt, {
        kind: 'close',
        close,
      });
      return closed;
    });
  }

  /**
   * A tablet whose storage was wiped picks up the open day the server already has. Does nothing
   * when the tablet has an open day of its own.
   */
  async adoptShift(open: ShiftOpen, movements: CashMovement[]): Promise<StoredShift | undefined> {
    return this.store.transaction('rw', this.store.shifts, async () => {
      if (await this.openShift(open.deviceId)) return undefined;
      if (await this.store.shifts.get(open.id)) return undefined;
      const shift: StoredShift = {
        id: open.id,
        deviceId: open.deviceId,
        open,
        movements,
        isOpen: 1,
      };
      await this.store.shifts.add(shift);
      return shift;
    });
  }

  private async queueShiftEvent(
    deviceId: string,
    id: string,
    shiftId: string,
    at: string,
    event: ShiftEvent,
  ): Promise<void> {
    await this.store.shiftEvents.add({ id, deviceId, shiftId, at, event, status: 'queued' });
  }
}

export interface SyncResult {
  sent: number;
  failed: number;
  /** True when the network went away part-way; try again later. */
  offline: boolean;
}

/** Errors with these codes are about the bill itself; retrying won't help. */
const PERMANENT = new Set(['22023', '23505', '28000', '42501', '22P02', '23514']);

/**
 * Sends queued bills, then queued voids, oldest first. Stops at the first network failure.
 * `secret` is a counter tablet's device key; personal phones sync with the signed-in login.
 */
export async function syncOutbox(
  db: Db,
  outbox: Outbox,
  deviceId: string,
  secret?: string,
): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: 0, offline: false };

  // Drawer entries first, oldest first: a day's open must reach the server before its cash.
  const events = await outbox.store.shiftEvents.where('deviceId').equals(deviceId).sortBy('at');
  const stuck = new Set(events.filter((e) => e.status === 'failed').map((e) => e.shiftId));
  for (const entry of events.filter((e) => e.status === 'queued')) {
    if (stuck.has(entry.shiftId)) continue; // the rest of that day waits behind the failed entry
    const { error } = await db.rpc('record_shift', {
      p: entry.event as unknown as Json, // plain JSON: ids, strings, numbers
      ...(secret ? { p_secret: secret } : {}),
    });
    if (error && !PERMANENT.has(error.code)) {
      result.offline = true;
      return result;
    }
    if (error) {
      result.failed += 1;
      stuck.add(entry.shiftId);
      await outbox.store.shiftEvents.update(entry.id, { status: 'failed', error: error.message });
    } else {
      result.sent += 1;
      await outbox.store.shiftEvents.update(entry.id, { status: 'synced' });
    }
  }
  const all = await outbox.store.bills.where('deviceId').equals(deviceId).sortBy('createdAt');

  for (const bill of all.filter((b) => b.status === 'queued')) {
    const { error } = await db.rpc('upsert_order', {
      p: bill.payload as unknown as Json, // plain JSON: ids, strings, numbers
      ...(secret ? { p_secret: secret } : {}),
    });
    if (error && !PERMANENT.has(error.code)) {
      result.offline = true;
      await outbox.store.bills.update(bill.id, { attempts: bill.attempts + 1 });
      return result;
    }
    if (error) {
      result.failed += 1;
      await outbox.store.bills.update(bill.id, {
        status: 'failed',
        error: error.message,
        attempts: bill.attempts + 1,
      });
    } else {
      result.sent += 1;
      await outbox.store.bills.update(bill.id, {
        status: 'synced',
        syncedAt: new Date().toISOString(),
        attempts: bill.attempts + 1,
      });
    }
  }

  const fresh = await outbox.store.bills.where('deviceId').equals(deviceId).toArray();
  for (const bill of fresh.filter((b) => b.status === 'synced' && b.void?.status === 'queued')) {
    const request = bill.void;
    if (!request) continue;
    const { error } = await db.rpc('void_order', {
      p: {
        orderId: bill.id,
        deviceId,
        reason: request.reason,
        approvedBy: request.approvedBy,
        at: request.at,
      },
      ...(secret ? { p_secret: secret } : {}),
    });
    if (error && !PERMANENT.has(error.code)) {
      result.offline = true;
      return result;
    }
    await outbox.store.bills.update(bill.id, {
      void: error
        ? { ...request, status: 'failed', error: error.message }
        : { ...request, status: 'synced' },
    });
    if (error) result.failed += 1;
    else result.sent += 1;
  }
  return result;
}

/** Where the server says this device's series got to. */
export async function serverLastBillSeq(
  db: Db,
  deviceId: string,
  financialYear: string,
  secret?: string,
): Promise<number> {
  const { data, error } = await db.rpc('device_last_bill_seq', {
    p_device_id: deviceId,
    p_financial_year: financialYear,
    ...(secret ? { p_secret: secret } : {}),
  });
  if (error) throw error;
  return data;
}

/** The open day the server has for this tablet, for a tablet whose storage was wiped. */
export async function serverOpenShift(
  db: Db,
  deviceId: string,
  secret?: string,
): Promise<{ open: ShiftOpen; movements: CashMovement[] } | null> {
  const { data, error } = await db.rpc('device_open_shift', {
    p_device_id: deviceId,
    ...(secret ? { p_secret: secret } : {}),
  });
  if (error) throw error;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const { movements, ...open } = data as unknown as ShiftOpen & { movements: CashMovement[] };
  return { open, movements };
}
