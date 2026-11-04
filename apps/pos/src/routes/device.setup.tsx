import { listManagedOutlets, registerDevice, signOut } from '@repo/db';
import { Button, cx, Input } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { db } from '../lib/db.ts';
import { saveDevice } from '../lib/device.ts';

export const Route = createFileRoute('/device/setup')({
  beforeLoad: async () => {
    const { data } = await db.auth.getSession();
    if (!data.session) throw redirect({ to: '/login' });
  },
  component: DeviceSetup,
});

function DeviceSetup() {
  const navigate = useNavigate();
  const outlets = useQuery({
    queryKey: ['managed-outlets'],
    queryFn: () => listManagedOutlets(db),
  });
  const [outletId, setOutletId] = useState<string>();
  const [label, setLabel] = useState('Counter tablet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const chosen = outletId ?? outlets.data?.[0]?.id;

  const register = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(undefined);
    try {
      saveDevice(await registerDevice(db, chosen, label.trim() || 'Counter tablet'));
      // A shared counter device must never stay signed in as the owner.
      await signOut(db);
      await navigate({ to: '/pin' });
    } catch {
      setError('Couldn’t register this device. Check your connection and try again.');
      setBusy(false);
    }
  };

  const leave = async () => {
    await signOut(db);
    await navigate({ to: '/login' });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold">Set up this device</h1>
        <p className="text-ink-2">
          Choose the outlet this tablet works at. Staff will sign in here with their PIN, and you
          will be signed out.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink-2">Outlet</legend>
        {outlets.isPending ? <p className="text-ink-2">Loading outlets…</p> : null}
        {outlets.data?.length === 0 ? (
          <p className="text-ink-2">
            You don&rsquo;t manage any outlets yet. Ask the owner to add you to one.
          </p>
        ) : null}
        <div className="flex flex-col rounded-lg border border-line bg-surface">
          {outlets.data?.map((outlet) => (
            <label
              key={outlet.id}
              className={cx(
                'flex h-tap-lg cursor-pointer items-center gap-3 border-b border-line px-4 last:border-0',
                chosen === outlet.id && 'bg-accent-soft',
              )}
            >
              <input
                type="radio"
                name="outlet"
                value={outlet.id}
                checked={chosen === outlet.id}
                onChange={() => {
                  setOutletId(outlet.id);
                }}
                className="size-5 accent-(--accent)"
              />
              <span className="flex-1 font-medium">{outlet.name}</span>
              <span className="num text-sm text-ink-2">{outlet.code}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Input
        label="Device name"
        hint="So you can tell tablets apart, e.g. Counter tablet or Kitchen screen."
        value={label}
        maxLength={60}
        onChange={(event) => {
          setLabel(event.target.value);
        }}
      />

      <div className="flex flex-col gap-2">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button
          variant="accent"
          size="lg"
          busy={busy}
          disabled={!chosen}
          onClick={() => void register()}
        >
          Register device
        </Button>
        <Button variant="ghost" onClick={() => void leave()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
