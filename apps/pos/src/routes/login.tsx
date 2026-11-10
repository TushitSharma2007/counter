import { brand } from '@repo/config/brand';
import { signInWithPassword } from '@repo/db';
import { Button, Icon, Input } from '@repo/ui';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ChartNoAxesColumn, ChefHat, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';

export const Route = createFileRoute('/login')({
  component: Login,
});

const WHAT_YOU_GET = [
  { icon: ReceiptText, text: 'Billing that keeps going when the internet drops' },
  { icon: ChefHat, text: 'Orders on the kitchen screen the moment they are billed' },
  { icon: ChartNoAxesColumn, text: 'Every outlet’s sales, live, on your phone' },
];

function Login() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const result = await signInWithPassword(db, email.trim(), password);
    setBusy(false);
    // On a shared counter tablet an owner only manages the device; anywhere else this is their phone.
    if (result.ok) await navigate({ to: loadDevice() ? '/device/setup' : '/home' });
    else setError(result.message);
  };

  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-ink p-10 text-canvas md:flex">
        <p className="font-display text-2xl font-semibold">{brand.pos.name}</p>
        <ul className="flex flex-col gap-5">
          {WHAT_YOU_GET.map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-md text-canvas/85">
              <Icon icon={icon} size={22} className="mt-0.5 shrink-0 text-canvas/60" />
              {text}
            </li>
          ))}
        </ul>
        <p className="text-sm text-canvas/50">
          Counter staff sign in with their PIN on the outlet&rsquo;s tablet.
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-10 md:px-16">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-1">
            <p className="font-display text-xl font-semibold md:hidden">{brand.pos.name}</p>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-ink-2">For owners and managers.</p>
          </div>

          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              autoFocus
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              {...(error ? { error } : {})}
            />
            <Button type="submit" variant="accent" size="lg" busy={busy} className="mt-2 text-lg">
              Sign in
            </Button>
          </form>

          <Link
            to="/pair"
            className="flex h-12 items-center justify-center rounded-md border border-line-strong text-base font-medium active:bg-sunken"
          >
            Setting up a counter tablet? Use a pairing code
          </Link>

          <p className="border-t border-line pt-4 text-sm text-ink-2 md:hidden">
            Counter staff sign in with their PIN on the outlet&rsquo;s tablet.
          </p>
        </div>
      </main>
    </div>
  );
}
