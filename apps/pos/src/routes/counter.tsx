import { signOut } from '@repo/db';
import { StatusPill } from '@repo/ui';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { BillingScreen } from '../billing/BillingScreen.tsx';
import { getActor, setActor, useActor } from '../lib/actor.ts';
import { db } from '../lib/db.ts';
import { loadCachedRoster, loadDevice } from '../lib/device.ts';

// A shared counter tablet: whoever signed in with their PIN bills here; Lock hands it back.
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

function Counter() {
  const actor = useActor();
  const navigate = useNavigate();
  const roster = loadCachedRoster();

  if (!actor) return null;

  const lock = async () => {
    setActor(undefined);
    await signOut(db);
    await navigate({ to: '/pin' });
  };

  return (
    <BillingScreen
      outletName={roster?.outlet.name ?? ''}
      deviceCode={roster?.device.code ?? ''}
      staff={{ id: actor.membershipId, name: actor.name, role: actor.role }}
      endAction={{ label: 'Lock', icon: Lock, onClick: () => void lock() }}
      banner={
        actor.mode === 'offline' ? (
          <p className="flex shrink-0 items-center gap-2 bg-warning-soft px-4 py-1.5 text-sm text-warning">
            <StatusPill tone="warning" className="!h-6">
              Offline
            </StatusPill>
            {actor.name} signed in on this tablet. Bills will sync when the internet is back.
          </p>
        ) : null
      }
    />
  );
}
