import {
  fetchBillingContext,
  fetchBills,
  getMe,
  listManagedOutlets,
  voidBillFromPhone,
  type ServerBill,
} from '@repo/db';
import { businessDate } from '@repo/pos-core';
import {
  Button,
  formatINR,
  Icon,
  Input,
  Segmented,
  Select,
  Sheet,
  SheetContent,
  StatusPill,
  toast,
} from '@repo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react';
import { useState } from 'react';
import { savedPaperWidth, usePrint } from '../billing/print.ts';
import { Receipt } from '../billing/Receipt.tsx';
import { whatsAppLink } from '../billing/share.ts';
import { VoidDialog } from '../billing/VoidDialog.tsx';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';

// Every tablet's bills at an outlet, by day, for owners and managers on their own phone.
export const Route = createFileRoute('/bills')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: '/' });
    const { data } = await db.auth.getSession();
    if (!data.session) throw redirect({ to: '/login' });
  },
  component: BillsPage,
});

const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});
const MODE: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card' };

function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

function BillsPage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => getMe(db) });
  const outlets = useQuery({
    queryKey: ['managed-outlets'],
    queryFn: () => listManagedOutlets(db),
  });
  const today = businessDate(new Date().toISOString());
  const [outletId, setOutletId] = useState<string>();
  const [day, setDay] = useState(today);
  const [selected, setSelected] = useState<ServerBill>();
  const [voiding, setVoiding] = useState<ServerBill>();
  const { print, portal } = usePrint();

  const outlet = outletId ?? outlets.data?.[0]?.id ?? '';
  const bills = useQuery({
    queryKey: ['server-bills', outlet, day],
    enabled: outlet !== '',
    queryFn: () => fetchBills(db, { outletId: outlet, businessDate: day }),
  });
  const context = useQuery({
    queryKey: ['billing-context', outlet],
    enabled: outlet !== '',
    queryFn: () => fetchBillingContext(db, outlet),
  });

  const paid = (bills.data ?? []).filter((b) => b.status === 'paid');
  const total = paid.reduce((s, b) => s + b.payload.totals.totalPaise, 0);
  const byMode = new Map<string, number>();
  for (const b of paid)
    for (const p of b.payload.payments)
      byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + p.amountPaise);
  const voids = (bills.data ?? []).filter((b) => b.status === 'void');

  const daySegment = day === today ? 'today' : day === shiftDay(today, -1) ? 'yesterday' : 'other';

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-2 bg-ink px-2 text-canvas md:px-4">
        <Link
          to="/home"
          className="flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium active:bg-canvas/10"
        >
          <Icon icon={ArrowLeft} size={18} />
          My outlets
        </Link>
        <span className="ml-2 font-display text-lg font-semibold">Bills</span>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select
            label="Outlet"
            hideLabel
            value={outlet}
            options={(outlets.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
            onChange={(e) => {
              setOutletId(e.target.value);
            }}
          />
          <div className="flex gap-2">
            <Segmented
              label="Day"
              value={daySegment}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
              ]}
              onChange={(v) => {
                if (v === 'today') setDay(today);
                if (v === 'yesterday') setDay(shiftDay(today, -1));
              }}
              className="min-w-52"
            />
            <Input
              label="Pick a day"
              hideLabel
              type="date"
              value={day}
              max={today}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-line bg-surface p-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-ink-2">Sales</dt>
            <dd className="num font-display text-xl font-semibold">{formatINR(total)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-2">Bills</dt>
            <dd className="num font-display text-xl font-semibold">{paid.length}</dd>
          </div>
          {['cash', 'upi', 'card'].map((mode) => (
            <div key={mode}>
              <dt className="text-sm text-ink-2">{MODE[mode]}</dt>
              <dd className="num text-md font-medium">{formatINR(byMode.get(mode) ?? 0)}</dd>
            </div>
          ))}
          <div>
            <dt className="text-sm text-ink-2">Voids</dt>
            <dd className="num text-md font-medium">{voids.length}</dd>
          </div>
        </dl>

        {bills.isPending ? <p className="text-ink-2">Loading bills…</p> : null}
        {bills.data?.length === 0 ? <p className="py-6 text-ink-2">No bills on this day.</p> : null}
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          {bills.data?.map((bill) => (
            <li key={bill.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => {
                  setSelected(bill);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sunken"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="num font-semibold">{bill.payload.billNumber}</span>
                    <span className="text-sm text-ink-2">
                      {time.format(new Date(bill.payload.createdAt))} · {bill.payload.billedBy.name}
                    </span>
                  </p>
                  <p className="truncate text-sm text-ink-2">
                    {bill.payload.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}
                  </p>
                </div>
                {bill.status === 'void' ? (
                  <StatusPill tone="neutral" className="!h-6">
                    Void
                  </StatusPill>
                ) : null}
                <span
                  className={
                    bill.status === 'void' ? 'num text-ink-3 line-through' : 'num font-medium'
                  }
                >
                  {formatINR(bill.payload.totals.totalPaise)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <Sheet
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
      >
        {selected && context.data ? (
          <SheetContent side="right" title={selected.payload.billNumber} className="!max-w-lg">
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ink-2">
                {selected.payload.payments
                  .map((p) => `${MODE[p.mode] ?? p.mode} ${formatINR(p.amountPaise)}`)
                  .join(' + ')}
                {selected.void
                  ? ` · voided by ${selected.void.approvedByName ?? 'a manager'}: ${selected.void.reason}`
                  : ''}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  onClick={() => {
                    const width = savedPaperWidth();
                    print(
                      <Receipt
                        bill={selected.payload}
                        context={context.data}
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
                  <a
                    href={whatsAppLink(selected.payload, context.data)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon icon={MessageCircle} size={18} />
                    WhatsApp
                  </a>
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border border-line bg-sunken p-3">
                <Receipt
                  bill={selected.payload}
                  context={context.data}
                  width={80}
                  {...(selected.void ? { voided: selected.void } : {})}
                />
              </div>
              {selected.status === 'paid' ? (
                <Button
                  variant="danger"
                  size="lg"
                  onClick={() => {
                    setVoiding(selected);
                  }}
                >
                  Void this bill
                </Button>
              ) : null}
            </div>
            {portal}
          </SheetContent>
        ) : null}
      </Sheet>

      {me.data ? (
        <VoidDialog
          bill={voiding}
          approvers={[]}
          self={{ membershipId: me.data.membershipId, name: me.data.name }}
          onClose={() => {
            setVoiding(undefined);
          }}
          onVoid={(v) => {
            const bill = voiding;
            const who = me.data;
            setVoiding(undefined);
            if (!bill || !who) return;
            voidBillFromPhone(db, {
              orderId: bill.id,
              outletId: outlet,
              reason: v.reason,
              approvedBy: who.membershipId,
              phoneLabel: `${who.name}’s phone`,
            })
              .then(() => {
                toast({
                  title: 'Bill voided',
                  description: `${bill.payload.billNumber} · ${v.reason}`,
                  tone: 'success',
                });
                setSelected(undefined);
                void queryClient.invalidateQueries({ queryKey: ['server-bills'] });
              })
              .catch(() => {
                toast({
                  title: 'Couldn’t void',
                  description: 'Check your connection and try again.',
                  tone: 'danger',
                });
              });
          }}
        />
      ) : null}
    </div>
  );
}
