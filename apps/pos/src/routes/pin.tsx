import {
  checkPinOffline,
  DeviceNotRegisteredError,
  fetchRoster,
  pinLogin,
  type PinLoginResult,
  type RosterMember,
} from '@repo/db';
import { Avatar, Button, cx, Icon, NumberPad, SyncIndicator } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { setActor } from '../lib/actor.ts';
import { db } from '../lib/db.ts';
import { cacheRoster, forgetDevice, loadCachedRoster, loadDevice } from '../lib/device.ts';
import { useOnline } from '../lib/online.ts';

export const Route = createFileRoute('/pin')({
  beforeLoad: () => {
    const device = loadDevice();
    // Not a shared tablet: '/' sends an owner's phone to their outlets, anyone else to sign-in.
    if (!device) throw redirect({ to: '/' });
    return { device };
  },
  component: PinScreen,
});

const PIN_LENGTH = 4;
const OFFLINE_MAX_TRIES = 5;
const OFFLINE_LOCK_MS = 5 * 60_000;

const time = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});
const date = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Kolkata',
});

const ROLE_LABEL: Record<RosterMember['role'], string> = {
  manager: 'Manager',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
};

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 15_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);
  return now;
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

/** The lock screen: tap your face, type four digits, you're in. Night theme so "locked" is obvious. */
function PinScreen() {
  const { device } = Route.useRouteContext();
  const navigate = useNavigate();
  const online = useOnline();
  const now = useNow();

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
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const offlineFailures = useRef(new Map<string, { count: number; lockedUntil: number }>());

  if (roster.error instanceof DeviceNotRegisteredError) {
    return <DeviceRemoved />;
  }

  const fail = (text: string) => {
    setMessage(text);
    setShake((n) => n + 1);
    setPin('');
  };

  const choose = (member: RosterMember) => {
    setSelected(member);
    setPin('');
    setMessage(undefined);
  };

  const checkOffline = async (member: RosterMember, typed: string): Promise<boolean> => {
    const record = offlineFailures.current.get(member.membershipId) ?? { count: 0, lockedUntil: 0 };
    if (record.lockedUntil > Date.now()) {
      fail(`Too many tries. Try again after ${time.format(record.lockedUntil)}.`);
      return false;
    }
    if (await checkPinOffline(typed, member.pinHash)) {
      offlineFailures.current.delete(member.membershipId);
      return true;
    }
    record.count += 1;
    if (record.count >= OFFLINE_MAX_TRIES) {
      record.count = 0;
      record.lockedUntil = Date.now() + OFFLINE_LOCK_MS;
      fail(`Too many tries. Try again after ${time.format(record.lockedUntil)}.`);
    } else {
      const left = OFFLINE_MAX_TRIES - record.count;
      fail(`Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
    }
    offlineFailures.current.set(member.membershipId, record);
    return false;
  };

  const submit = async (typed: string) => {
    if (!selected || busy) return;
    setBusy(true);
    setMessage(undefined);

    const result: PinLoginResult = online
      ? await pinLogin(db, device, selected.membershipId, typed).catch((): PinLoginResult => ({
          ok: false,
          reason: 'offline',
        }))
      : { ok: false, reason: 'offline' };

    let mode: 'online' | 'offline' | undefined;
    if (result.ok) mode = 'online';
    else if (result.reason === 'offline') {
      if (await checkOffline(selected, typed)) mode = 'offline';
    } else {
      if (result.reason === 'device') forgetDevice();
      fail(failureMessage(result, selected.name));
    }

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

  const type = (next: string) => {
    setPin(next);
    setMessage(undefined);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  const data = roster.data;

  return (
    <div data-theme="dark" className="flex min-h-dvh flex-col bg-canvas text-ink">
      <main className="grid flex-1 md:grid-cols-[1fr_26rem]">
        <section className={cx('flex flex-col gap-8 p-6 md:p-10', selected && 'hidden md:flex')}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="num font-display text-[56px] leading-none font-medium tracking-[-0.03em] md:text-[72px]">
                {time.format(now)}
              </p>
              <p className="mt-2 text-md text-ink-2">{date.format(now)}</p>
            </div>
            <SyncIndicator state={online ? 'live' : 'offline'} className="mt-2 shrink-0" />
          </div>

          <div>
            <p className="text-sm text-ink-2">
              {data ? `${data.outlet.name} · ${data.outlet.orgName} · ${data.device.code}` : ' '}
            </p>
            <h1 className="mt-1 text-xl font-semibold">Who&rsquo;s working?</h1>
          </div>

          {!data && roster.isPending ? <p className="text-ink-2">Loading staff…</p> : null}
          {!data && roster.isError ? (
            <p className="max-w-prose text-ink-2">
              Couldn&rsquo;t load staff. Connect to the internet once so this tablet learns who
              works here.
            </p>
          ) : null}
          {data?.staff.length === 0 ? (
            <p className="max-w-prose text-ink-2">
              No one can sign in here yet. Ask the owner to set a PIN for staff at{' '}
              {data.outlet.name}.
            </p>
          ) : null}

          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
            {data?.staff.map((member) => {
              const on = selected?.membershipId === member.membershipId;
              return (
                <li key={member.membershipId}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${member.name}, ${ROLE_LABEL[member.role]}`}
                    onClick={() => {
                      choose(member);
                    }}
                    className={cx(
                      'flex w-full flex-col items-center gap-2 rounded-lg border px-2 pt-4 pb-3 text-center',
                      'transition-colors duration-100 active:bg-sunken',
                      on ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                    )}
                  >
                    <Avatar name={member.name} id={member.membershipId} size={64} />
                    <span className="line-clamp-2 text-base leading-tight font-semibold">
                      {member.name}
                    </span>
                    <span className="text-sm text-ink-2">{ROLE_LABEL[member.role]}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Link to="/login" className="mt-auto text-sm text-ink-2 underline underline-offset-4">
            Owner or manager? Sign in with email
          </Link>
        </section>

        <section
          aria-label="Enter PIN"
          className={cx(
            'flex-col items-stretch justify-center gap-5 border-line bg-surface p-6 md:flex md:border-l md:p-8',
            selected ? 'flex' : 'hidden',
          )}
        >
          {selected ? (
            <>
              <Button
                variant="ghost"
                className="-ml-2 self-start md:hidden"
                onClick={() => {
                  setSelected(undefined);
                }}
              >
                <Icon icon={ArrowLeft} />
                Choose someone else
              </Button>
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar name={selected.name} id={selected.membershipId} size={72} />
                <div>
                  <p className="text-lg font-semibold">{selected.name}</p>
                  <p className="text-ink-2">Enter your 4-digit PIN</p>
                </div>
                <div
                  key={shake}
                  className={cx('flex h-10 items-center gap-4', shake > 0 && 'animate-shake')}
                  aria-hidden
                >
                  {Array.from({ length: PIN_LENGTH }, (_, i) => (
                    <span
                      key={i}
                      className={cx(
                        'size-4 rounded-full border-2 transition-colors duration-100',
                        i < pin.length ? 'border-ink bg-ink' : 'border-line-strong',
                      )}
                    />
                  ))}
                  {busy ? (
                    <Icon
                      icon={LoaderCircle}
                      size={18}
                      className="absolute ml-36 animate-spin text-ink-2"
                    />
                  ) : null}
                </div>
                <p role="alert" className="min-h-6 text-base font-medium text-danger">
                  {message}
                </p>
              </div>
              <NumberPad
                label={`PIN for ${selected.name}`}
                value={pin}
                onChange={type}
                maxLength={PIN_LENGTH}
                keepLeadingZeros
                captureKeyboard
                size="lg"
              />
              {!online ? (
                <p className="text-center text-sm text-ink-2">
                  Offline. Your PIN is checked on this tablet; bills sync when the internet is back.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mx-auto max-w-56 text-center text-md text-ink-2">
              Tap your name to sign in.
            </p>
          )}
        </section>
      </main>
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
