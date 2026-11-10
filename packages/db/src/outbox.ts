// The offline outbox (CLAUDE.md §7). Every paid bill is written here first, numbered in the same
// IndexedDB transaction, then sent to the server in the background. Billing never waits for the
// network. A bill the server refuses is kept and marked for attention, never dropped.
import type { OrderPayload } from '@repo/pos-core';
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

interface Counter {
  /** `${deviceId}:${financialYear}` */
  key: string;
  last: number;
}

class OutboxDb extends Dexie {
  bills!: EntityTable<StoredBill, 'id'>;
  counters!: EntityTable<Counter, 'key'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      bills: 'id, deviceId, status, createdAt',
      counters: 'key',
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

  /** Bills or voids still to reach the server. */
  async pending(deviceId: string): Promise<{ queued: number; failed: number }> {
    const bills = await this.store.bills.where('deviceId').equals(deviceId).toArray();
    return {
      queued: bills.filter((b) => b.status === 'queued' || b.void?.status === 'queued').length,
      failed: bills.filter((b) => b.status === 'failed' || b.void?.status === 'failed').length,
    };
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
