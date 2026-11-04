import { brand } from '@repo/config/brand';
import { signInWithPassword } from '@repo/db';
import { Button, Input } from '@repo/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { db } from '../lib/db.ts';

export const Route = createFileRoute('/login')({
  component: Login,
});

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
    if (result.ok) await navigate({ to: '/device/setup' });
    else setError(result.message);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col gap-1">
        <p className="font-display text-xl font-semibold">{brand.pos.name}</p>
        <h1 className="text-lg font-semibold">Sign in</h1>
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
        <Button type="submit" variant="accent" size="lg" busy={busy} className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="border-t border-line pt-4 text-sm text-ink-2">
        Counter staff sign in with their PIN on a registered tablet.
      </p>
    </main>
  );
}
