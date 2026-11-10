import type { BillingContext, StoredBill } from '@repo/db';
import { Button, Dialog, DialogContent, formatINR, Icon, Segmented } from '@repo/ui';
import { MessageCircle, Printer } from 'lucide-react';
import { useState } from 'react';
import { savedPaperWidth, savePaperWidth, usePrint, type PaperWidth } from './print.ts';
import { Receipt } from './Receipt.tsx';
import { whatsAppLink } from './share.ts';

/** After payment: change to give, print, share, next customer. */
export function PaidSheet({
  bill,
  context,
  onNext,
}: {
  bill: StoredBill | undefined;
  context: BillingContext;
  onNext: () => void;
}) {
  const [width, setWidth] = useState<PaperWidth>(savedPaperWidth);
  const { print, portal } = usePrint();
  const payload = bill?.payload;
  const payment = payload?.payments[0];
  const change = payment?.tenderedPaise ? payment.tenderedPaise - payment.amountPaise : 0;

  return (
    <Dialog
      open={bill !== undefined}
      onOpenChange={(open) => {
        if (!open) onNext();
      }}
    >
      {payload ? (
        <DialogContent
          title="Bill paid"
          description={payload.billNumber}
          size="lg"
          footer={
            <Button
              variant="accent"
              size="lg"
              className="w-full text-lg sm:w-auto sm:min-w-56"
              onClick={onNext}
              autoFocus
            >
              New bill
            </Button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-4">
              <dl className="flex flex-col">
                <div className="flex items-baseline justify-between border-b border-line py-2">
                  <dt className="text-ink-2">Total</dt>
                  <dd className="num font-display text-2xl font-semibold">
                    {formatINR(payload.totals.totalPaise)}
                  </dd>
                </div>
                {change > 0 ? (
                  <div className="flex items-baseline justify-between py-2">
                    <dt className="text-ink-2">Change to return</dt>
                    <dd className="num font-display text-2xl font-semibold text-success">
                      {formatINR(change)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <Segmented
                label="Paper width"
                value={String(width)}
                options={[
                  { value: '58', label: '58 mm' },
                  { value: '80', label: '80 mm' },
                ]}
                onChange={(v) => {
                  const next: PaperWidth = v === '58' ? 58 : 80;
                  setWidth(next);
                  savePaperWidth(next);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  onClick={() => {
                    print(<Receipt bill={payload} context={context} width={width} />, width);
                  }}
                >
                  <Icon icon={Printer} size={18} />
                  Print
                </Button>
                <Button size="lg" asChild>
                  <a href={whatsAppLink(payload, context)} target="_blank" rel="noreferrer">
                    <Icon icon={MessageCircle} size={18} />
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
            <div className="hidden max-h-[60vh] overflow-y-auto rounded-md border border-line bg-sunken p-3 sm:block">
              <div className="origin-top scale-90 shadow-float">
                <Receipt bill={payload} context={context} width={width} />
              </div>
            </div>
          </div>
          {portal}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
