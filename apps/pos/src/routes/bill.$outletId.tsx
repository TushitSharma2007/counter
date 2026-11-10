import { ensurePersonalDevice, getMe, listManagedOutlets } from '@repo/db';
import { Button } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Store } from 'lucide-react';
import { useEffect } from 'react';
import { BillingScreen } from '../billing/BillingScreen.tsx';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';
import { cachedPersonalDevice, cachePersonalDevice, rememberOutlet } from '../lib/personal.ts';

// An owner or manager billing from their own phone at the outlet they're at. The phone gets its
// own counter code there the first time, so its bill numbers never clash with the counter tablet.
export const Route = createFileRoute('/bill/$outletId')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: '/' });
    const { data } = await db.auth.getSession();
    if (!data.session) throw redirect({ to: '/login' });
  },
  component: PersonalBilling,
});

function PersonalBilling() {
  const { outletId } = Route.useParams();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['me'], queryFn: () => getMe(db) });
  const outlets = useQuery({
    queryKey: ['managed-outlets'],
    queryFn: () => listManagedOutlets(db),
  });
  const outlet = outlets.data?.find((o) => o.id === outletId);

  const device = useQuery({
    queryKey: ['personal-device', outletId],
    enabled: me.data !== undefined,
    queryFn: async () => {
      const fresh = await ensurePersonalDevice(db, outletId, `${me.data?.name ?? 'Owner'}’s phone`);
      cachePersonalDevice({ ...fresh, ...(outlet ? { outletName: outlet.name } : {}) });
      return fresh;
    },
    // Offline: billing still opens at an outlet this phone has used before.
    initialData: () => cachedPersonalDevice(outletId),
    initialDataUpdatedAt: 0,
    retry: false,
  });

  useEffect(() => {
    if (device.data) rememberOutlet(outletId);
  }, [device.data, outletId]);

  const back = () => void navigate({ to: '/home' });

  if (device.isError && !device.data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold">Can&rsquo;t bill here from this phone</h1>
        <p className="text-ink-2">
          Either you&rsquo;re not set up at this outlet, or this phone hasn&rsquo;t billed here
          before and is offline. Connect to the internet once and try again.
        </p>
        <Button variant="accent" size="lg" onClick={back}>
          Back to my outlets
        </Button>
      </main>
    );
  }

  if (!device.data || !me.data) {
    return (
      <p className="grid min-h-dvh place-items-center text-ink-2">
        Opening {outlet?.name ?? 'the outlet'}…
      </p>
    );
  }

  return (
    <BillingScreen
      outletId={outletId}
      outletName={outlet?.name ?? cachedPersonalDevice(outletId)?.outletName ?? ''}
      device={{ id: device.data.deviceId, code: device.data.code }}
      billedBy={{ membershipId: me.data.membershipId, name: me.data.name }}
      approvers={[]}
      selfApprover={{ membershipId: me.data.membershipId, name: me.data.name }}
      staff={{ id: me.data.userId, name: me.data.name, role: me.data.role }}
      endAction={{ label: 'Outlets', icon: Store, onClick: back }}
    />
  );
}
