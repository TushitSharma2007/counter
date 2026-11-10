// The log book (CLAUDE.md §5 item 5): every counter tablet's day at an outlet, one page per day,
// with the cash in and out behind it. Read-only; tablets write it through record_shift.
import type { CashMovement } from '@repo/pos-core';
import type { Db } from './client.ts';

export interface LogBookShift {
  id: string;
  deviceCode: string;
  deviceLabel: string;
  businessDate: string;
  openedAt: string;
  openedByName: string;
  openingCashPaise: number;
  /** Not closed yet when undefined. */
  closed?: { at: string; byName: string; countedCashPaise: number; differencePaise: number };
  note: string | null;
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

export interface LogBookDay {
  businessDate: string;
  shifts: LogBookShift[];
  salesPaise: number;
  /** Short (negative) or over (positive) across the day's closed drawers. */
  differencePaise: number;
  open: number;
}

const DAYS = 60;

/** The most recent days with a drawer at this outlet, newest first. */
export async function fetchLogBook(db: Db, outletId: string): Promise<LogBookDay[]> {
  const { data, error } = await db
    .from('shift_summaries')
    .select('*')
    .eq('outlet_id', outletId)
    .order('business_date', { ascending: false })
    .order('opened_at', { ascending: true })
    .limit(DAYS * 4);
  if (error) throw error;

  const days = new Map<string, LogBookDay>();
  for (const r of data) {
    const shift: LogBookShift = {
      id: r.id,
      deviceCode: r.device_code,
      deviceLabel: r.device_label,
      businessDate: r.business_date,
      openedAt: r.opened_at,
      openedByName: r.opened_by_name,
      openingCashPaise: r.opening_cash_paise,
      ...(r.closed_at && r.counted_cash_paise !== null
        ? {
            closed: {
              at: r.closed_at,
              byName: r.closed_by_name ?? '',
              countedCashPaise: r.counted_cash_paise,
              differencePaise: r.difference_paise ?? 0,
            },
          }
        : {}),
      note: r.note,
      bills: r.bills ?? 0,
      salesPaise: r.sales_paise ?? 0,
      voids: r.voids ?? 0,
      voidPaise: r.void_paise ?? 0,
      cashSalesPaise: r.cash_sales_paise ?? 0,
      upiSalesPaise: r.upi_sales_paise ?? 0,
      cardSalesPaise: r.card_sales_paise ?? 0,
      cashInPaise: r.cash_in_paise ?? 0,
      cashOutPaise: r.cash_out_paise ?? 0,
      expectedCashPaise: r.expected_cash_paise ?? 0,
    };
    const day = days.get(shift.businessDate) ?? {
      businessDate: shift.businessDate,
      shifts: [],
      salesPaise: 0,
      differencePaise: 0,
      open: 0,
    };
    day.shifts.push(shift);
    day.salesPaise += shift.salesPaise;
    if (shift.closed) day.differencePaise += shift.closed.differencePaise;
    else day.open += 1;
    days.set(shift.businessDate, day);
  }
  return [...days.values()].slice(0, DAYS);
}

/** Cash in and out for these drawers, oldest first. */
export async function fetchCashMovements(db: Db, shiftIds: string[]): Promise<CashMovement[]> {
  if (shiftIds.length === 0) return [];
  const { data, error } = await db
    .from('cash_movements')
    .select('id, shift_id, kind, amount_paise, reason, by_membership, by_name, created_at')
    .in('shift_id', shiftIds)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    shiftId: m.shift_id,
    kind: m.kind === 'in' ? 'in' : 'out',
    amountPaise: m.amount_paise,
    reason: m.reason,
    by: m.by_membership,
    byName: m.by_name,
    at: m.created_at,
  }));
}
