import { signOut } from '@repo/db';
import { Button, Icon, StatusPill, SyncIndicator } from '@repo/ui';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { getActor, setActor, useActor } from '../lib/actor.ts';
import { db } from '../lib/db.ts';
import { loadCachedRoster, loadDevice } from '../lib/device.ts';
import { useOnline } from '../lib/online.ts';

export const Route = createFileRoute('/counter')({
  beforeLoad: async () => {
    if (!loadDevice()) throw redirect({ to: '/' });
    const actor = getActor();
    if (!actor) throw redirect({ to: '/pin' });
    // An online sign-in whose session has gone (expired, signed out elsewhere) must PIN in again.
    if (actor.mode === 'online') {
      const { data } = await db.auth.getSession();
      if (!data.session) {
        setActor(undefined);
        throw redirect({ to: '/pin' });
      }
    }
  },
  component: Counter,
});

// Placeholder for the billing screen (CLAUDE.md §5 item 3).
function Counter() {
  const actor = useActor();
  const online = useOnline();
  const navigate = useNavigate();
  const roster = loadCachedRoster();

  const lock = async () => {
    setActor(undefined);
    await signOut(db);
    await navigate({ to: '/pin' });
  };

  if (!actor) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 md:px-6">
        <p className="min-w-0 truncate">
          <span className="font-display text-md font-semibold">{roster?.outlet.name}</span>
          <span className="ml-2 text-sm text-ink-2">{roster?.device.code}</span>
        </p>
        <SyncIndicator state={online ? 'live' : 'offline'} className="ml-auto shrink-0" />
        <Button variant="ghost" onClick={() => void lock()} className="shrink-0">
          <Icon icon={Lock} size={18} />
          Lock
        </Button>
      </header>
      <main className="flex flex-1 flex-col gap-3 p-4 md:p-6">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{actor.name}</span>
          <StatusPill tone="neutral">{actor.role}</StatusPill>
          {actor.mode === 'offline' ? (
            <StatusPill tone="warning">Signed in offline</StatusPill>
          ) : null}
        </p>
        <p className="max-w-prose text-ink-2">
          Billing comes next. Tap Lock when you step away, so the next person signs in with their
          own PIN.
        </p>
      </main>
    </div>
  );
}
