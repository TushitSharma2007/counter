import 'fake-indexeddb/auto';
import type { OrderPayload } from '@repo/pos-core';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from './client.ts';
import { Outbox, syncOutbox } from './outbox.ts';

let dbCount = 0;
const fresh = () => new Outbox(`test-outbox-${++dbCount}`);

function payload(
  seq: number,
  id = `00000000-0000-7000-8000-${String(seq).padStart(12, '0')}`,
): OrderPayload {
  return {
    id,
    deviceId: 'device-1',
    outletId: 'outlet-1',
    financialYear: '2627',
    billSeq: seq,
    billNumber: `ARC-T1/2627/${String(seq).padStart(6, '0')}`,
    businessDate: '2026-11-10',
    createdAt: `2026-11-10T06:00:${String(seq).padStart(2, '0')}Z`,
    orderType: 'counter',
    customerPhone: null,
    billedBy: { membershipId: 'm-1', name: 'Priya Sharma' },
    tax: { gstScheme: 'regular', pricesIncludeTax: true, rounding: 'bill' },
    totals: {
      itemTotalPaise: 4900,
      taxablePaise: 4667,
      cgstPaise: 117,
      sgstPaise: 116,
      roundOffPaise: 0,
      totalPaise: 4900,
    },
    lines: [],
    payments: [],
  };
}

/** A fake Supabase client whose rpc answers from a script. */
function fakeDb(
  answer: (fn: string, args: unknown) => { error: { code: string; message: string } | null },
) {
  const rpc = vi.fn((fn: string, args: unknown) =>
    Promise.resolve({ data: null, ...answer(fn, args) }),
  );
  return { db: { rpc } as unknown as Db, rpc };
}

describe('Outbox.addBill', () => {
  it('numbers bills 1, 2, 3 for a device and year', async () => {
    const outbox = fresh();
    for (let i = 0; i < 3; i++) await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    const numbers = (await outbox.recent('device-1')).map((b) => b.payload.billSeq).sort();
    expect(numbers).toEqual([1, 2, 3]);
  });

  it('never gives two bills the same number, even when added at the same moment', async () => {
    const outbox = fresh();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        outbox.addBill('device-1', '2627', (seq) =>
          payload(seq, `00000000-0000-7000-8000-0000000001${String(i).padStart(2, '0')}`),
        ),
      ),
    );
    const numbers = (await outbox.recent('device-1'))
      .map((b) => b.payload.billSeq)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('starts a new series each financial year, and catches up with the server', async () => {
    const outbox = fresh();
    await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    await outbox.catchUpCounter('device-1', '2627', 41);
    const next = await outbox.addBill('device-1', '2627', (seq) =>
      payload(seq, '00000000-0000-7000-8000-000000000999'),
    );
    expect(next.payload.billSeq).toBe(42);
    await outbox.catchUpCounter('device-1', '2627', 5); // never goes backwards
    const other = await outbox.addBill('device-1', '2728', (seq) => ({
      ...payload(seq, '00000000-0000-7000-8000-000000000888'),
      financialYear: '2728',
    }));
    expect(other.payload.billSeq).toBe(1);
  });
});

describe('syncOutbox', () => {
  it('sends queued bills oldest first and marks them synced', async () => {
    const outbox = fresh();
    await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    const { db, rpc } = fakeDb(() => ({ error: null }));
    expect(await syncOutbox(db, outbox, 'device-1', 'secret')).toEqual({
      sent: 2,
      failed: 0,
      offline: false,
    });
    expect(rpc.mock.calls.map((c) => (c[1] as { p: OrderPayload }).p.billSeq)).toEqual([1, 2]);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_secret: 'secret' });
    expect(await outbox.pending('device-1')).toEqual({ queued: 0, failed: 0 });
  });

  it('stops at a network failure and keeps the rest queued', async () => {
    const outbox = fresh();
    for (let i = 0; i < 3; i++) await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    let calls = 0;
    const { db } = fakeDb(() =>
      ++calls === 2 ? { error: { code: '', message: 'Failed to fetch' } } : { error: null },
    );
    expect(await syncOutbox(db, outbox, 'device-1')).toEqual({ sent: 1, failed: 0, offline: true });
    expect(await outbox.pending('device-1')).toEqual({ queued: 2, failed: 0 });
  });

  it('keeps a bill the server refuses, marked for attention, and carries on', async () => {
    const outbox = fresh();
    await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    let calls = 0;
    const { db } = fakeDb(() =>
      ++calls === 1
        ? { error: { code: '22023', message: 'Bill lines don’t add up.' } }
        : { error: null },
    );
    expect(await syncOutbox(db, outbox, 'device-1')).toEqual({
      sent: 1,
      failed: 1,
      offline: false,
    });
    const failed = (await outbox.recent('device-1')).find((b) => b.status === 'failed');
    expect(failed?.error).toBe('Bill lines don’t add up.');
  });

  it('sends a void once the bill itself is on the server', async () => {
    const outbox = fresh();
    const bill = await outbox.addBill('device-1', '2627', (seq) => payload(seq));
    await outbox.requestVoid(bill.id, {
      reason: 'Customer cancelled',
      approvedBy: 'm-9',
      approvedByName: 'Rohan',
      at: '2026-11-10T06:05:00Z',
    });
    const { db, rpc } = fakeDb(() => ({ error: null }));
    await syncOutbox(db, outbox, 'device-1');
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['upsert_order', 'void_order']);
    expect((await outbox.get(bill.id))?.void?.status).toBe('synced');
  });
});
