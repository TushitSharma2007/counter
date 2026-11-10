// A counter tablet's cash drawer for a day (CLAUDE.md §5 item 5). Opened by counting the cash,
// cash in/out with a reason, closed by counting again. What's expected in the drawer:
// opening cash + cash taken on paid bills (not change) + cash in - cash out.
import { businessDate, uuidv7, type OrderPayload } from './order.ts';

export interface ShiftOpen {
  id: string;
  deviceId: string;
  businessDate: string;
  openedAt: string;
  openedBy: string | null;
  openedByName: string;
  openingCashPaise: number;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  kind: 'in' | 'out';
  amountPaise: number;
  reason: string;
  by: string | null;
  byName: string;
  at: string;
}

export interface ShiftClose {
  shiftId: string;
  closedAt: string;
  closedBy: string | null;
  closedByName: string;
  countedCashPaise: number;
  expectedCashPaise: number;
  note: string | null;
}

/** What the outbox sends to `record_shift`, in the order it happened. */
export type ShiftEvent =
  | { kind: 'open'; shift: ShiftOpen }
  | { kind: 'cash'; movement: CashMovement }
  | { kind: 'close'; close: ShiftClose };

interface Who {
  membershipId: string | null;
  name: string;
}

const MAX_PAISE = 100_000_000; // ₹10 lakh: more than any kiosk drawer, catches a slipped finger

function checkAmount(paise: number, allowZero: boolean): void {
  if (!Number.isInteger(paise) || paise < (allowZero ? 0 : 1) || paise > MAX_PAISE) {
    throw new RangeError(`Cash amount ${paise} is out of range`);
  }
}

export function openShift(input: {
  deviceId: string;
  openingCashPaise: number;
  by: Who;
  now: string;
  dayCloseHour?: number;
  newId?: () => string;
}): ShiftOpen {
  checkAmount(input.openingCashPaise, true);
  return {
    id: (input.newId ?? uuidv7)(),
    deviceId: input.deviceId,
    businessDate: businessDate(input.now, input.dayCloseHour),
    openedAt: input.now,
    openedBy: input.by.membershipId,
    openedByName: input.by.name,
    openingCashPaise: input.openingCashPaise,
  };
}

export function cashMovement(input: {
  shiftId: string;
  kind: CashMovement['kind'];
  amountPaise: number;
  reason: string;
  by: Who;
  now: string;
  newId?: () => string;
}): CashMovement {
  checkAmount(input.amountPaise, false);
  const reason = input.reason.trim();
  if (reason.length === 0 || reason.length > 200) throw new RangeError('A reason is needed');
  return {
    id: (input.newId ?? uuidv7)(),
    shiftId: input.shiftId,
    kind: input.kind,
    amountPaise: input.amountPaise,
    reason,
    by: input.by.membershipId,
    byName: input.by.name,
    at: input.now,
  };
}

/** The bills a summary needs: their payments, and whether they were voided. */
export interface ShiftBill {
  payments: OrderPayload['payments'];
  totalPaise: number;
  voided: boolean;
}

export interface ShiftSummary {
  bills: number;
  salesPaise: number;
  voids: number;
  voidPaise: number;
  cashSalesPaise: number;
  upiSalesPaise: number;
  cardSalesPaise: number;
  cashInPaise: number;
  cashOutPaise: number;
  expectedCashPaise: number;
}

export function summariseShift(
  shift: Pick<ShiftOpen, 'openingCashPaise'>,
  movements: readonly Pick<CashMovement, 'kind' | 'amountPaise'>[],
  bills: readonly ShiftBill[],
): ShiftSummary {
  const s: ShiftSummary = {
    bills: 0,
    salesPaise: 0,
    voids: 0,
    voidPaise: 0,
    cashSalesPaise: 0,
    upiSalesPaise: 0,
    cardSalesPaise: 0,
    cashInPaise: 0,
    cashOutPaise: 0,
    expectedCashPaise: 0,
  };
  for (const bill of bills) {
    if (bill.voided) {
      s.voids += 1;
      s.voidPaise += bill.totalPaise;
      continue;
    }
    s.bills += 1;
    s.salesPaise += bill.totalPaise;
    for (const p of bill.payments) {
      // amountPaise is what the bill took; any extra cash tendered went back as change.
      if (p.mode === 'cash') s.cashSalesPaise += p.amountPaise;
      else if (p.mode === 'upi') s.upiSalesPaise += p.amountPaise;
      else s.cardSalesPaise += p.amountPaise;
    }
  }
  for (const m of movements) {
    if (m.kind === 'in') s.cashInPaise += m.amountPaise;
    else s.cashOutPaise += m.amountPaise;
  }
  s.expectedCashPaise = shift.openingCashPaise + s.cashSalesPaise + s.cashInPaise - s.cashOutPaise;
  return s;
}

export function closeShift(input: {
  shiftId: string;
  countedCashPaise: number;
  expectedCashPaise: number;
  note?: string;
  by: Who;
  now: string;
}): ShiftClose {
  checkAmount(input.countedCashPaise, true);
  const note = input.note?.trim() ?? '';
  if (note.length > 500) throw new RangeError('The note is too long');
  return {
    shiftId: input.shiftId,
    closedAt: input.now,
    closedBy: input.by.membershipId,
    closedByName: input.by.name,
    countedCashPaise: input.countedCashPaise,
    expectedCashPaise: input.expectedCashPaise,
    note: note === '' ? null : note,
  };
}

/** Counted minus expected: negative is short, positive is over. */
export function cashDifference(countedPaise: number, expectedPaise: number): number {
  return countedPaise - expectedPaise;
}
