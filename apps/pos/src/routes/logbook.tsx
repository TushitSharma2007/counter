import {
  fetchCashMovements,
  fetchLogBook,
  listManagedOutlets,
  type LogBookDay,
  type LogBookShift,
} from '@repo/db';
import type { CashMovement } from '@repo/pos-core';
import { Button, cx, formatINR, Icon, Select, StatusPill } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { LedgerRow } from '../components/Ledger.tsx';
import { differenceText } from '../lib/cash.ts';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';

// The log book (CLAUDE.md §5 item 5): one page per outlet per day, like a ledger.
export const Route = createFileRoute('/logbook')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: '/' });
    const { data } = await db.auth.getSession();
    if (!data.session) throw redirect({ to: '/login' });
  },
  component: LogBookPage,
});

const dayLong = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayShort = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

function DayStatus({ day }: { day: LogBookDay }) {
  if (day.open > 0)
    return (
      <StatusPill tone="neutral" className="!h-6">
        Open
      </StatusPill>
    );
  return (
    <StatusPill
      tone={day.differencePaise < 0 ? 'danger' : day.differencePaise > 0 ? 'warning' : 'success'}
      className="!h-6"
    >
      {differenceText(day.differencePaise)}
    </StatusPill>
  );
}

function LogBookPage() {
  const outlets = useQuery({
    queryKey: ['managed-outlets'],
    queryFn: () => listManagedOutlets(db),
  });
  const [outletId, setOutletId] = useState<string>();
  const [picked, setPicked] = useState<string>();
  const outlet = outletId ?? outlets.data?.[0]?.id ?? '';

  const book = useQuery({
    queryKey: ['logbook', outlet],
    enabled: outlet !== '',
    queryFn: () => fetchLogBook(db, outlet),
  });
  const days = book.data ?? [];
  const selected = days.find((d) => d.businessDate === picked) ?? days[0];
  const outletName = outlets.data?.find((o) => o.id === outlet)?.name ?? '';

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
        <span className="ml-2 font-display text-lg font-semibold">Log book</span>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-5 md:grid-cols-[18rem_1fr]">
        <aside className={cx('flex flex-col gap-3', picked && 'hidden md:flex')}>
          <Select
            label="Outlet"
            hideLabel
            value={outlet}
            options={(outlets.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
            onChange={(e) => {
              setOutletId(e.target.value);
              setPicked(undefined);
            }}
          />
          {book.isPending && outlet ? <p className="text-ink-2">Opening the log book…</p> : null}
          {book.isError ? (
            <p className="text-danger">Couldn&rsquo;t load the log book. Check your connection.</p>
          ) : null}
          {book.data?.length === 0 ? (
            <div className="flex flex-col items-start gap-2 py-6 text-ink-2">
              <Icon icon={BookOpen} size={24} />
              <p>
                No days yet. A page appears here when a counter tablet at {outletName} starts the
                day.
              </p>
            </div>
          ) : null}
          <nav aria-label="Days">
            <ul className="overflow-hidden rounded-lg border border-line bg-surface">
              {days.map((day) => (
                <li key={day.businessDate} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    aria-current={selected?.businessDate === day.businessDate ? 'page' : undefined}
                    onClick={() => {
                      setPicked(day.businessDate);
                    }}
                    className={cx(
                      'flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-sunken',
                      selected?.businessDate === day.businessDate && 'md:bg-accent-soft',
                    )}
                  >
                    <span>
                      <span className="block font-medium">
                        {dayShort.format(asDate(day.businessDate))}
                      </span>
                      <span className="num text-sm text-ink-2">{formatINR(day.salesPaise)}</span>
                    </span>
                    <DayStatus day={day} />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {selected ? (
          <section
            aria-label={`Log book page for ${dayLong.format(asDate(selected.businessDate))}`}
            className={cx('min-w-0', !picked && 'hidden md:block')}
          >
            <Button
              variant="ghost"
              className="-ml-2 mb-2 md:hidden"
              onClick={() => {
                setPicked(undefined);
              }}
            >
              <Icon icon={ArrowLeft} size={18} />
              All days
            </Button>
            <DayPage day={selected} outletName={outletName} />
          </section>
        ) : null}
      </main>
    </div>
  );
}

function DayPage({ day, outletName }: { day: LogBookDay; outletName: string }) {
  const movements = useQuery({
    queryKey: ['cash-movements', day.shifts.map((s) => s.id)],
    queryFn: () =>
      fetchCashMovements(
        db,
        day.shifts.map((s) => s.id),
      ),
  });
  const bills = day.shifts.reduce((s, x) => s + x.bills, 0);

  return (
    <article className="flex flex-col gap-6">
      <header className="border-b border-line-strong pb-3">
        <p className="text-sm text-ink-2">{outletName}</p>
        <h1 className="font-display text-2xl font-semibold">
          {dayLong.format(asDate(day.businessDate))}
        </h1>
        <p className="num mt-1 text-ink-2">
          {formatINR(day.salesPaise)} in sales · {bills} {bills === 1 ? 'bill' : 'bills'}
        </p>
      </header>
      {day.shifts.map((shift) => (
        <ShiftPage
          key={shift.id}
          shift={shift}
          movements={(movements.data ?? []).filter((m) => m.shiftId === shift.id)}
        />
      ))}
    </article>
  );
}

function ShiftPage({ shift, movements }: { shift: LogBookShift; movements: CashMovement[] }) {
  const difference = shift.closed?.differencePaise ?? 0;
  return (
    <section
      aria-label={`${shift.deviceCode} ${shift.deviceLabel}`}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-md font-semibold">
          {shift.deviceCode} · {shift.deviceLabel}
        </h2>
        <p className="text-sm text-ink-2">
          Opened {time.format(new Date(shift.openedAt))} by {shift.openedByName}
          {shift.closed
            ? ` · Closed ${time.format(new Date(shift.closed.at))} by ${shift.closed.byName}`
            : ' · Still open'}
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[1fr_14rem]">
        <div className="self-start rounded-lg border border-line bg-surface px-4">
          <LedgerRow label="Opening cash" paise={shift.openingCashPaise} />
          <LedgerRow label="Cash sales" paise={shift.cashSalesPaise} sign="+" />
          {movements.map((m) => (
            <LedgerRow
              key={m.id}
              label={m.reason}
              detail={`${m.kind === 'in' ? 'Cash in' : 'Cash out'} · ${time.format(new Date(m.at))} · ${m.byName}`}
              paise={m.amountPaise}
              sign={m.kind === 'in' ? '+' : '−'}
            />
          ))}
          <LedgerRow label="Expected in drawer" paise={shift.expectedCashPaise} strong />
          {shift.closed ? (
            <>
              <LedgerRow label="Counted" paise={shift.closed.countedCashPaise} />
              <LedgerRow
                label="Difference"
                detail={differenceText(difference)}
                paise={Math.abs(difference)}
                strong
                {...(difference < 0 ? { tone: 'danger' as const } : {})}
              />
            </>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-3">
          <div className="col-span-2">
            <dt className="text-sm text-ink-2">Sales</dt>
            <dd className="num font-display text-xl font-semibold">
              {formatINR(shift.salesPaise)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-2">Bills</dt>
            <dd className="num font-medium">{shift.bills}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-sm text-ink-2">Cash · UPI · Card</dt>
            <dd className="num font-medium">
              {formatINR(shift.cashSalesPaise)} · {formatINR(shift.upiSalesPaise)} ·{' '}
              {formatINR(shift.cardSalesPaise)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-2">Voids</dt>
            <dd className="num font-medium">
              {shift.voids}
              {shift.voids > 0 ? ` · ${formatINR(shift.voidPaise)}` : ''}
            </dd>
          </div>
        </dl>
      </div>
      {shift.note ? (
        <p className="border-l-2 border-line-strong pl-3 text-ink-2">
          <span className="font-medium text-ink">Note:</span> {shift.note}
        </p>
      ) : null}
    </section>
  );
}
