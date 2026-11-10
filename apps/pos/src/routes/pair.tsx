import { brand } from '@repo/config/brand';
import { formatPairingCode, FriendlyError, pairDevice } from '@repo/db';
import { Button } from '@repo/ui';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { db } from '../lib/db.ts';
import { loadDevice, saveDevice } from '../lib/device.ts';
import { forgetPersonal } from '../lib/personal.ts';

// On a new tablet: type the code the owner or manager got on their phone. No password needed here.
export const Route = createFileRoute('/pair')({
  beforeLoad: () => {
    if (loadDevice()) throw redirect({ to: '/' });
  },
  component: Pair,
});

function Pair() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const clean = code.replace(/[^A-Z0-9]/g, '');

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      saveDevice(await pairDevice(db, clean));
      forgetPersonal();
      await navigate({ to: '/pin' });
    } catch (e) {
      setError(
        e instanceof FriendlyError
          ? e.message
          : 'Couldn’t reach the server. Check the internet and try again.',
      );
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="flex flex-col gap-1">
        <p className="font-display text-xl font-semibold">{brand.pos.name}</p>
        <h1 className="text-xl font-semibold">Set up this tablet</h1>
        <p className="text-ink-2">
          Type the code from the owner&rsquo;s or manager&rsquo;s phone (Staff &amp; devices → Add a
          counter tablet).
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean.length === 8) void submit();
        }}
      >
        <label htmlFor="pairing-code" className="text-sm font-medium text-ink-2">
          Pairing code
        </label>
        <input
          id="pairing-code"
          value={code}
          onChange={(e) => {
            setCode(formatPairingCode(e.target.value));
            setError(undefined);
          }}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXX-XXXX"
          className="num h-16 rounded-md border border-line-strong bg-surface px-4 text-center font-display text-[32px] font-semibold tracking-[0.12em] uppercase outline-none placeholder:text-ink-3 focus:outline-2 focus:outline-offset-1 focus:outline-accent"
          aria-describedby={error ? 'pair-error' : undefined}
        />
        {error ? (
          <p id="pair-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="accent"
          size="lg"
          busy={busy}
          disabled={clean.length !== 8}
          className="text-lg"
        >
          Set up tablet
        </Button>
      </form>

      <Link
        to="/login"
        className="border-t border-line pt-4 text-sm text-ink-2 underline underline-offset-4"
      >
        Owner or manager? Sign in with email instead
      </Link>
    </main>
  );
}
