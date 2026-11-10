import type { BillingContext, StoredBill } from '@repo/db';
import { Button, formatINR, Icon, Sheet, SheetContent, StatusPill, toast } from '@repo/ui';
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { savedPaperWidth, usePrint } from './print.ts';
import { Receipt } from './Receipt.tsx';
import { whatsAppLink } from './share.ts';
import { outbox } from './sync.ts';
import { VoidDialog, type Approver } from './VoidDialog.tsx';

const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

function Status({ bill }: { bill: StoredBill }) {
  if (bill.void) {
    return (
      <StatusPill tone={bill.void.status === 'failed' ? 'danger' : 'neutral'} className="!h-6">
        {bill.void.status === 'queued'
          ? 'Void, waiting to sync'
          : bill.void.status === 'failed'
            ? 'Void needs attention'
            : 'Void'}
      </StatusPill>
    );
  }
  if (bill.status === 'failed')
    return (
      <StatusPill tone="danger" className="!h-6">
        Needs attention
      </StatusPill>
    );
  if (bill.status === 'queued')
    return (
      <StatusPill tone="warning" className="!h-6">
        Waiting to sync
      </StatusPill>
    );
  return (
    <StatusPill tone="success" className="!h-6">
      Synced
    </StatusPill>
  );
}

/** Bills made on this device: status, reprint, share, void. */
export function BillsSheet({
  open,
  deviceId,
  context,
  approvers,
  self,
  onClose,
  onChanged,
}: {
  open: boolean;
  deviceId: string;
  context: BillingContext;
  approvers: Approver[];
  self?: Approver;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [bills, setBills] = useState<StoredBill[]>([]);
  const [selected, setSelected] = useState<StoredBill>();
  const [voiding, setVoiding] = useState<StoredBill>();
  const { print, portal } = usePrint();

  const show = useCallback((list: StoredBill[]) => {
    setBills(list);
    setSelected((current) => (current ? list.find((b) => b.id === current.id) : undefined));
  }, []);

  const load = useCallback(() => outbox.recent(deviceId, 200).then(show), [deviceId, show]);

  useEffect(() => {
    if (open) outbox.recent(deviceId, 200).then(show, () => undefined);
  }, [open, deviceId, show]);

  const today = bills.filter((b) => b.payload.businessDate === bills[0]?.payload.businessDate);
  const total = today.filter((b) => !b.void).reduce((s, b) => s + b.payload.totals.totalPaise, 0);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelected(undefined);
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        title={selected ? selected.payload.billNumber : 'Bills on this device'}
        {...(selected
          ? {}
          : { description: `${today.length} today · ${formatINR(total)} (excluding voids)` })}
        className="!max-w-lg"
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <Button
              variant="ghost"
              className="-ml-2 self-start"
              onClick={() => {
                setSelected(undefined);
              }}
            >
              <Icon icon={ArrowLeft} size={18} />
              All bills
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Status bill={selected} />
              {selected.error ? <p className="text-sm text-danger">{selected.error}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                onClick={() => {
                  const width = savedPaperWidth();
                  print(
                    <Receipt
                      bill={selected.payload}
                      context={context}
                      width={width}
                      {...(selected.void ? { voided: selected.void } : {})}
                    />,
                    width,
                  );
                }}
              >
                <Icon icon={Printer} size={18} />
                Reprint
              </Button>
              <Button size="lg" asChild>
                <a href={whatsAppLink(selected.payload, context)} target="_blank" rel="noreferrer">
                  <Icon icon={MessageCircle} size={18} />
                  WhatsApp
                </a>
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-line bg-sunken p-3">
              <Receipt
                bill={selected.payload}
                context={context}
                width={80}
                {...(selected.void ? { voided: selected.void } : {})}
              />
            </div>
            {!selected.void ? (
              <Button
                variant="danger"
                size="lg"
                onClick={() => {
                  setVoiding(selected);
                }}
              >
                Void this bill
              </Button>
            ) : (
              <p className="text-sm text-ink-2">
                Voided by {selected.void.approvedByName}: {selected.void.reason}
              </p>
            )}
          </div>
        ) : bills.length === 0 ? (
          <p className="py-8 text-ink-2">No bills on this device yet.</p>
        ) : (
          <ul>
            {bills.map((bill) => (
              <li key={bill.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(bill);
                  }}
                  className="flex w-full items-center gap-3 py-3 text-left active:bg-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="num font-semibold">{bill.payload.billNumber}</span>
                      <span className="text-sm text-ink-2">
                        {time.format(new Date(bill.createdAt))}
                      </span>
                    </p>
                    <p className="truncate text-sm text-ink-2">
                      {bill.payload.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}
                    </p>
                    <div className="mt-1">
                      <Status bill={bill} />
                    </div>
                  </div>
                  <span className={bill.void ? 'num text-ink-3 line-through' : 'num font-medium'}>
                    {formatINR(bill.payload.totals.totalPaise)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {portal}
      </SheetContent>

      <VoidDialog
        bill={voiding}
        approvers={approvers}
        {...(self ? { self } : {})}
        onClose={() => {
          setVoiding(undefined);
        }}
        onVoid={(v) => {
          const bill = voiding;
          setVoiding(undefined);
          if (!bill) return;
          void outbox
            .requestVoid(bill.id, { ...v, at: new Date().toISOString() })
            .then(async () => {
              toast({
                title: 'Bill voided',
                description: `${bill.payload.billNumber} · ${v.reason}`,
                tone: 'success',
              });
              await load();
              onChanged();
            });
        }}
      />
    </Sheet>
  );
}
