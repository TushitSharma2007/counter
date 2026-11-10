import { brand } from '@repo/config/brand';
import { getMe, listManagedOutlets, signOut } from '@repo/db';
import { Avatar, cx, Icon, StatusPill } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { ChartNoAxesColumn, ChevronRight, LogOut, Tablet } from 'lucide-react';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';
import { forgetPersonal, lastOutlet } from '../lib/personal.ts';

// An owner's or manager's own phone: pick the outlet you're at and bill there, or (soon) see
// every outlet at once. Shared counter tablets never come here.
export const Route = createFileRoute('/home')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: '/device/setup' });
    const { data } = await db.auth.getSession();
    if (!data.session) throw redirect({ to: '/login' });
  },
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['me'], queryFn: () => getMe(db) });
  const outlets = useQuery({
    queryKey: ['managed-outlets'],
    queryFn: () => listManagedOutlets(db),
  });
  const last = lastOutlet();

  const leave = async () => {
    forgetPersonal();
    await signOut(db);
    await navigate({ to: '/login' });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 bg-ink px-4 text-canvas">
        <span className="font-display text-lg font-semibold">{brand.pos.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {me.data ? (
            <>
              <Avatar name={me.data.name} id={me.data.userId} size={32} />
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-medium">{me.data.name}</p>
                <p className="text-xs text-canvas/60 capitalize">{me.data.role}</p>
              </div>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void leave()}
            className="ml-1 flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium active:bg-canvas/10"
          >
            <Icon icon={LogOut} size={18} />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold">My outlets</h1>
          <p className="text-ink-2">Tap the outlet you&rsquo;re at to bill from this phone.</p>
        </div>

        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          <li className="flex h-20 items-center gap-4 border-b border-line px-4">
            <span className="grid size-11 place-items-center rounded-md bg-sunken text-ink-2">
              <Icon icon={ChartNoAxesColumn} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-md font-semibold">All outlets</p>
              <p className="text-sm text-ink-2">
                Live sales across every outlet comes with the dashboard.
              </p>
            </div>
          </li>
          {outlets.isPending ? <li className="px-4 py-6 text-ink-2">Loading outlets…</li> : null}
          {outlets.data?.length === 0 ? (
            <li className="px-4 py-6 text-ink-2">
              You don&rsquo;t manage any outlets yet. Ask the owner to add you to one.
            </li>
          ) : null}
          {outlets.data?.map((outlet) => (
            <li key={outlet.id} className="border-b border-line last:border-0">
              <Link
                to="/bill/$outletId"
                params={{ outletId: outlet.id }}
                className={cx('flex h-20 items-center gap-4 px-4 active:bg-sunken')}
              >
                <span className="num grid size-11 place-items-center rounded-md bg-ink text-sm font-semibold text-canvas">
                  {outlet.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-md font-semibold">
                    {outlet.name}
                    {outlet.id === last ? (
                      <StatusPill tone="neutral" className="!h-6 !text-xs">
                        Last used
                      </StatusPill>
                    ) : null}
                  </p>
                  <p className="text-sm text-ink-2">Bill here from this phone</p>
                </div>
                <Icon icon={ChevronRight} className="text-ink-2" />
              </Link>
            </li>
          ))}
        </ul>

        <section className="flex items-start gap-3 border-t border-line pt-5">
          <Icon icon={Tablet} size={22} className="mt-0.5 shrink-0 text-ink-2" />
          <div>
            <p className="font-semibold">Setting up a counter tablet?</p>
            <p className="text-sm text-ink-2">
              Do this on the tablet that stays at the outlet. Staff then sign in on it with their
              PIN, and you are signed out of it.
            </p>
            <Link
              to="/device/setup"
              className="mt-2 inline-flex h-11 items-center text-sm font-medium text-accent underline underline-offset-4"
            >
              Set up this device as a shared counter
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
