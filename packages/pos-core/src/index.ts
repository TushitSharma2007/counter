// Pure POS business logic: bill totals, GST, cart. No React, no Supabase; also runs on Deno.
export {
  cashChange,
  computeBill,
  DEFAULT_TAX,
  type BillLineInput,
  type BillTotals,
  type TaxGroup,
  type TaxSettings,
} from './logic/bill.ts';
export {
  cartReducer,
  EMPTY_CART,
  itemCount,
  lineKey,
  type Cart,
  type CartAction,
  type CartLine,
  type Modifier,
  type OrderType,
  type PaymentMode,
} from './logic/cart.ts';
