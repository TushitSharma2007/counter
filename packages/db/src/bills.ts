// Bills as the server has them: for owners and managers looking across tablets, and voiding from
// their own phone. Rebuilt into the same shape the device keeps, so the same receipt renders them.
import type { OrderPayload } from '@repo/pos-core';
import type { Db } from './client.ts';
import { ensurePersonalDevice } from './staff-auth.ts';

export interface ServerBill {
  id: string;
  payload: OrderPayload;
  status: 'paid' | 'void';
  deviceCode: string;
  void?: { reason: string; at: string; approvedByName: string | null };
}

const LIMIT = 500;

/** All bills at an outlet for one business day, newest first. */
export async function fetchBills(
  db: Db,
  { outletId, businessDate }: { outletId: string; businessDate: string },
): Promise<ServerBill[]> {
  const { data, error } = await db
    .from('orders')
    .select(
      `id, device_id, outlet_id, financial_year, bill_seq, bill_number, business_date, created_at,
       order_type, customer_phone, billed_by, billed_by_name, gst_scheme, prices_include_tax,
       tax_rounding, item_total_paise, taxable_paise, cgst_paise, sgst_paise, round_off_paise,
       total_paise, status, void_reason, voided_at,
       device:devices!orders_device_id_org_id_fkey (code),
       voider:memberships!orders_voided_by_fkey (profiles (full_name)),
       order_items (id, item_id, name, variant_name, modifiers, unit_paise, qty, tax_rate_bp, line_total_paise, sort),
       payments (id, mode, amount_paise, tendered_paise)`,
    )
    .eq('outlet_id', outletId)
    .eq('business_date', businessDate)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;

  return data.map((o) => {
    const payload: OrderPayload = {
      id: o.id,
      deviceId: o.device_id,
      outletId: o.outlet_id,
      financialYear: o.financial_year,
      billSeq: o.bill_seq,
      billNumber: o.bill_number,
      businessDate: o.business_date,
      createdAt: o.created_at,
      orderType: o.order_type as OrderPayload['orderType'],
      customerPhone: o.customer_phone,
      billedBy: { membershipId: o.billed_by, name: o.billed_by_name },
      tax: {
        gstScheme: o.gst_scheme === 'composition' ? 'composition' : 'regular',
        pricesIncludeTax: o.prices_include_tax,
        rounding: o.tax_rounding === 'line' ? 'line' : 'bill',
      },
      totals: {
        itemTotalPaise: o.item_total_paise,
        taxablePaise: o.taxable_paise,
        cgstPaise: o.cgst_paise,
        sgstPaise: o.sgst_paise,
        roundOffPaise: o.round_off_paise,
        totalPaise: o.total_paise,
      },
      lines: [...o.order_items]
        .sort((a, b) => a.sort - b.sort)
        .map((l) => ({
          id: l.id,
          itemId: l.item_id ?? '',
          name: l.name,
          variantName: l.variant_name,
          modifiers: Array.isArray(l.modifiers)
            ? (l.modifiers as OrderPayload['lines'][number]['modifiers'])
            : [],
          unitPaise: l.unit_paise,
          qty: l.qty,
          taxRateBp: l.tax_rate_bp,
          lineTotalPaise: l.line_total_paise,
        })),
      payments: o.payments.map((p) => ({
        id: p.id,
        mode: p.mode === 'upi' || p.mode === 'card' ? p.mode : 'cash',
        amountPaise: p.amount_paise,
        tenderedPaise: p.tendered_paise,
      })),
    };
    return {
      id: o.id,
      payload,
      status: o.status,
      deviceCode: o.device.code,
      ...(o.status === 'void' && o.voided_at
        ? {
            void: {
              reason: o.void_reason ?? '',
              at: o.voided_at,
              approvedByName: o.voider?.profiles.full_name ?? null,
            },
          }
        : {}),
    };
  });
}

/**
 * An owner or manager voids a bill from their own phone. It goes through the phone's own device
 * at that outlet, so the same server checks and audit log apply.
 */
export async function voidBillFromPhone(
  db: Db,
  v: { orderId: string; outletId: string; reason: string; approvedBy: string; phoneLabel: string },
): Promise<void> {
  const device = await ensurePersonalDevice(db, v.outletId, v.phoneLabel);
  const { error } = await db.rpc('void_order', {
    p: {
      orderId: v.orderId,
      deviceId: device.deviceId,
      reason: v.reason,
      approvedBy: v.approvedBy,
      at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}
