// An owner's or manager's own phone: its counter code at each outlet, and the last outlet used.
// Cached so billing still opens offline at an outlet this phone has billed at before.
import { PersonalDevice } from '@repo/db';
import { z } from 'zod';

const DEVICES_KEY = 'counter.personal-devices';
const LAST_KEY = 'counter.last-outlet';

const Cached = PersonalDevice.extend({ outletName: z.string().optional() });
type Cached = z.infer<typeof Cached>;
const Cache = z.record(z.string(), Cached);

function readCache(): Record<string, Cached> {
  try {
    const parsed = Cache.safeParse(JSON.parse(localStorage.getItem(DEVICES_KEY) ?? '{}'));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function cachedPersonalDevice(outletId: string): Cached | undefined {
  return readCache()[outletId];
}

export function cachePersonalDevice(device: Cached): void {
  localStorage.setItem(DEVICES_KEY, JSON.stringify({ ...readCache(), [device.outletId]: device }));
}

export function lastOutlet(): string | undefined {
  return localStorage.getItem(LAST_KEY) ?? undefined;
}

export function rememberOutlet(outletId: string): void {
  localStorage.setItem(LAST_KEY, outletId);
}

/** On sign-out the next person on this phone must not inherit these. */
export function forgetPersonal(): void {
  localStorage.removeItem(DEVICES_KEY);
  localStorage.removeItem(LAST_KEY);
}
