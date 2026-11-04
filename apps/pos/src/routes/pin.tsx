import {
  checkPinOffline,
  DeviceNotRegisteredError,
  fetchRoster,
  pinLogin,
  type PinLoginResult,
  type RosterMember,
} from '@repo/db';
import { Button, cx, Icon, NumberPad, SyncIndicator } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useRef, useState } from 'react';
import { setActor } from '../lib/actor.ts';
import { db } from '../lib/db.ts';
import { cacheRoster, forgetDevice, loadCachedRoster, loadDevice } from '../lib/device.ts';
import { useOnline } from '../lib/online.ts';

export const Route = createFileRoute('/pin')({
  beforeLoad: () => {
    const device = loadDevice();
    if (!device) throw redirect({ to: '/login' });
    return { device };
  },
  component: PinScreen,
});

const OFFLINE_MAX_TRIES = 5;
const OFFLINE_LOCK_MS = 5 * 60_000;

const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

const ROLE_LABEL: Record<RosterMember['role'], string> = {
  manager: 'Manager',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function failureMessage(result: Exclude<PinLoginResult, { ok: true }>, name: string): string {
  switch (result.reason) {
    case 'wrong_pin': {
      const left = result.triesLeft ?? 0;
      return `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.`;
    }
    case 'locked':
      return result.until
        ? `Too many tries. Try again after ${time.format(new Date(result.until))}.`
        : 'Too many tries. Try again in 5 minutes.';
    case 'not_here':
      return `${name} isn’t set up at this outlet.`;
    case 'device':
      return 'This tablet isn’t registered any more.';
    case 'offline':
      return 'You’re offline.';
  }
}

function PinScreen() {
  const { device } = Route.useRouteContext();
  const navigate = useNavigate();
  const online = useOnline();

  const roster = useQuery({
    queryKey: ['roster', device.deviceId],
    queryFn: async () => {
      const fresh = await fetchRoster(db, device);
      cacheRoster(fresh);
      return fresh;
    },
    initialData: loadCachedRoster,
    initialDataUpdatedAt: 0, // always refresh the cached roster when we can
    retry: (count, error) => !(error instanceof DeviceNotRegisteredError) && count < 2,
  });

  const [selected, setSelected] = useState<RosterMember>();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const offlineFailures = useRef(new Map<string, { count: number; lockedUntil: number }>());

  if (roster.error instanceof DeviceNotRegisteredError) {
    return <DeviceRemoved />;
  }

  const choose = (member: RosterMember) => {
    setSelected(member);
    setPin('');
    setMessage(undefined);
  };

  const signInOffline = async (member: RosterMember): Promise<boolean> => {
    const record = offlineFailures.current.get(member.membershipId) ?? { count: 0, lockedUntil: 0 };
    if (record.lockedUntil > Date.now()) {
      setMessage(`Too many tries. Try again after ${time.format(record.lockedUntil)}.`);
      return false;
    }
    if (await checkPinOffline(pin, member.pinHash)) {
      offlineFailures.current.delete(member.membershipId);
      return true;
    }
    record.count += 1;
    if (record.count >= OFFLINE_MAX_TRIES) {
      record.count = 0;
      record.lockedUntil = Date.now() + OFFLINE_LOCK_MS;
      setMessage(`Too many tries. Try again after ${time.format(record.lockedUntil)}.`);
    } else {
      const left = OFFLINE_MAX_TRIES - record.count;
      setMessage(`Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
    }
    offlineFailures.current.set(member.membershipId, record);
    return false;
  };

  const submit = async () => {
    if (!selected || busy) return;
    if (pin.length < 4) {
      setMessage('Your PIN is 4 to 6 digits.');
      return;
    }
    setBusy(true);
    setMessage(undefined);

    let mode: 'online' | 'offline' | undefined;
    const result: PinLoginResult = online
      ? await pinLogin(db, device, selected.membershipId, pin).catch((): PinLoginResult => ({
          ok: false,
          reason: 'offline',
        }))
      : { ok: false, reason: 'offline' };

    if (result.ok) mode = 'online';
    else if (result.reason === 'offline') {
      if (await signInOffline(selected)) mode = 'offline';
    } else {
      if (result.reason === 'device') forgetDevice();
      setMessage(failureMessage(result, selected.name));
    }

    setPin('');
    setBusy(false);
    if (mode) {
      setActor({
        membershipId: selected.membershipId,
        name: selected.name,
        role: selected.role,
        mode,
        since: new Date().toISOString(),
      });
      await navigate({ to: '/counter' });
    }
  };

  const data = roster.data;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 md:px-6">
        <p className="min-w-0 truncate">
          <span className="font-display text-md font-semibold">{data?.outlet.name ?? ' '}</span>
          {data ? (
            <span className="ml-2 text-sm text-ink-2">
              {data.outlet.orgName} · {data.device.code}
            </span>
          ) : null}
        </p>
        <SyncIndicator state={online ? 'live' : 'offline'} className="ml-auto shrink-0" />
      </header>

      <main className="grid flex-1 md:grid-cols-[1fr_22rem] lg:grid-cols-[1fr_26rem]">
        <section className={cx('flex flex-col gap-4 p-4 md:p-6', selected && 'hidden md:flex')}>
          <h1 className="text-lg font-semibold">Who&rsquo;s at the counter?</h1>
          {!data && roster.isPending ? <p className="text-ink-2">Loading staff…</p> : null}
          {!data && roster.isError ? (
            <p className="text-ink-2">
              Couldn&rsquo;t load staff. Connect to the internet once so this tablet can learn who
              works here.
            </p>
          ) : null}
          {data?.staff.length === 0 ? (
            <p className="max-w-prose text-ink-2">
              No one can sign in here yet. Ask the owner to set a PIN for staff at{' '}
              {data.outlet.name}.
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data?.staff.map((member) => (
              <li key={member.membershipId}>
                <button
                  type="button"
                  aria-pressed={selected?.membershipId === member.membershipId}
                  onClick={() => {
                    choose(member);
                  }}
                  className={cx(
                    'flex h-20 w-full items-center gap-3 rounded-lg border px-3 text-left',
                    'transition-colors duration-100 active:bg-sunken',
                    selected?.membershipId === member.membershipId
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface',
                  )}
                >
                  <span
                    aria-hidden
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-sunken font-display text-md font-semibold text-ink-2"
                  >
                    {initials(member.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{member.name}</span>
                    <span className="block text-sm text-ink-2">{ROLE_LABEL[member.role]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={cx(
            'flex-col gap-4 border-line bg-surface p-4 md:flex md:border-l md:p-6',
            selected ? 'flex' : 'hidden',
          )}
          aria-label="Enter PIN"
        >
          {selected ? (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  aria-label="Choose someone else"
                  className="-ml-2 w-tap px-0 md:hidden"
                  onClick={() => {
                    setSelected(undefined);
                  }}
                >
                  <Icon icon={ArrowLeft} />
                </Button>
                <h2 className="text-md">
                  PIN for <span className="font-semibold">{selected.name}</span>
                </h2>
              </div>

              <div className="flex h-10 items-center gap-3" aria-hidden>
                {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                  <span
                    key={i}
                    className={cx(
                      'size-3.5 rounded-full border-2',
                      i < pin.length ? 'border-ink bg-ink' : 'border-line-strong',
                    )}
                  />
                ))}
                <span className="sr-only">{pin.length} digits entered</span>
              </div>

              <p role="alert" className="min-h-5 text-sm text-danger">
                {message}
              </p>

              <NumberPad
                label={`PIN for ${selected.name}`}
                value={pin}
                onChange={(next) => {
                  setPin(next);
                  setMessage(undefined);
                }}
                maxLength={6}
                captureKeyboard
                onEnter={() => void submit()}
              />
              <Button
                variant="accent"
                size="lg"
                busy={busy}
                disabled={pin.length < 4}
                onClick={() => void submit()}
              >
                Sign in
              </Button>
              {!online ? (
                <p className="text-sm text-ink-2">
                  Offline. Your PIN is checked on this tablet and bills sync when the internet is
                  back.
                </p>
              ) : null}
            </>
          ) : (
            <p className="m-auto max-w-56 text-center text-ink-2">
              Tap your name, then enter your PIN.
            </p>
          )}
        </section>
      </main>

      <footer className="border-t border-line px-4 py-3 text-sm md:px-6">
        <Link to="/login" className="text-ink-2 underline underline-offset-4">
          Owner or manager? Sign in with email
        </Link>
      </footer>
    </div>
  );
}

function DeviceRemoved() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="font-display text-xl font-semibold">This tablet was removed</h1>
      <p className="text-ink-2">
        An owner or manager revoked it. Sign in with email to set it up again.
      </p>
      <Button
        variant="accent"
        size="lg"
        onClick={() => {
          forgetDevice();
          void navigate({ to: '/login' });
        }}
      >
        Sign in with email
      </Button>
    </main>
  );
}
