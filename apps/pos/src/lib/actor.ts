// Who is working the counter right now. Online sign-ins also hold a Supabase session; an offline
// PIN switch only records the person, so their queued bills can be attributed when we sync.
import { PIN_ROLES } from '@repo/db';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

export const Actor = z.object({
  membershipId: z.uuid(),
  name: z.string(),
  role: z.enum(PIN_ROLES),
  mode: z.enum(['online', 'offline']),
  since: z.string(),
});
export type Actor = z.infer<typeof Actor>;

const KEY = 'counter.actor';
const listeners = new Set<() => void>();
let current: Actor | undefined = load();

function load(): Actor | undefined {
  try {
    const parsed = Actor.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function getActor(): Actor | undefined {
  return current;
}

export function setActor(actor: Actor | undefined): void {
  current = actor;
  if (actor) localStorage.setItem(KEY, JSON.stringify(actor));
  else localStorage.removeItem(KEY);
  for (const listener of listeners) listener();
}

export function useActor(): Actor | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getActor,
    getActor,
  );
}
