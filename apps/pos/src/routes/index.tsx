import { createFileRoute, redirect } from '@tanstack/react-router';
import { getActor } from '../lib/actor.ts';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';

// Sends everyone to the right place: shared counter tablets to the PIN screen (or straight to the
// counter if someone is signed in); an owner's or manager's own phone to their outlets; else sign-in.
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: getActor() ? '/counter' : '/pin' });
    const { data } = await db.auth.getSession();
    throw redirect({ to: data.session ? '/home' : '/login' });
  },
});
