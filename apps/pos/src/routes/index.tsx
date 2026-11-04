import { createFileRoute, redirect } from '@tanstack/react-router';
import { getActor } from '../lib/actor.ts';
import { db } from '../lib/db.ts';
import { loadDevice } from '../lib/device.ts';

// Sends everyone to the right place: registered counter devices to the PIN screen (or straight
// to the counter if someone is signed in); other browsers to owner sign-in or device setup.
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (loadDevice()) throw redirect({ to: getActor() ? '/counter' : '/pin' });
    const { data } = await db.auth.getSession();
    throw redirect({ to: data.session ? '/device/setup' : '/login' });
  },
});
