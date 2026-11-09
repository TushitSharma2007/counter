import { computeBill, itemCount } from '@repo/pos-core';
import { PriceTag, Sheet, SheetContent } from '@repo/ui';
import { ORDER_TYPES } from './options.ts';
import type { HeldBill } from './state.ts';

const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

export function HeldSheet({
  open,
  held,
  onClose,
  onResume,
}: {
  open: boolean;
  held: HeldBill[];
  onClose: () => void;
  onResume: (id: string) => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" title="Held bills" description="Tap a bill to bring it back.">
        {held.length === 0 ? (
          <p className="py-8 text-ink-2">
            No held bills. Tap Hold to park a bill and start the next one.
          </p>
        ) : (
          <ul>
            {held.map((bill) => (
              <li key={bill.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    onResume(bill.id);
                  }}
                  className="flex w-full items-center gap-3 py-3 text-left active:bg-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {bill.cart.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}
                    </p>
                    <p className="text-sm text-ink-2">
                      {time.format(bill.heldAt)} ·{' '}
                      {ORDER_TYPES.find((o) => o.value === bill.cart.orderType)?.label} ·{' '}
                      <span className="num">{itemCount(bill.cart)}</span> items
                    </p>
                  </div>
                  <PriceTag paise={computeBill(bill.cart.lines).totalPaise} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
