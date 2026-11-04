// Staff sign-in: owners and managers with email + password, everyone else with a PIN on a
// registered counter device (CLAUDE.md §4).
import bcrypt from 'bcryptjs';
import { FunctionsFetchError } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Db } from './client.ts';
import { PinLoginResponse, type PinLoginFailure } from './contracts/auth-pin.ts';

/** What a registered device keeps about itself. The secret is its credential. */
export const DeviceCredentials = z.object({
  deviceId: z.uuid(),
  outletId: z.uuid(),
  code: z.string(),
  label: z.string(),
  secret: z.string().regex(/^[0-9a-f]{64}$/),
});
export type DeviceCredentials = z.infer<typeof DeviceCredentials>;

export const PIN_ROLES = ['manager', 'cashier', 'kitchen'] as const;

export const RosterMember = z.object({
  membershipId: z.uuid(),
  name: z.string(),
  role: z.enum(PIN_ROLES),
  pinHash: z.string(),
});
export type RosterMember = z.infer<typeof RosterMember>;

/** Who can sign in on this device. Cached on the device so PIN switching works offline. */
export const Roster = z.object({
  outlet: z.object({ id: z.uuid(), name: z.string(), code: z.string(), orgName: z.string() }),
  device: z.object({ id: z.uuid(), code: z.string(), label: z.string() }),
  staff: z.array(RosterMember),
});
export type Roster = z.infer<typeof Roster>;

export type PinLoginResult = { ok: true } | PinLoginFailure | { ok: false; reason: 'offline' };

/** Thrown when the server no longer recognises this device (revoked or wiped). */
export class DeviceNotRegisteredError extends Error {
  constructor() {
    super('This device is not registered any more.');
    this.name = 'DeviceNotRegisteredError';
  }
}

export async function signInWithPassword(
  db: Db,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  return {
    ok: false,
    message:
      error.code === 'invalid_credentials'
        ? 'That email and password don’t match.'
        : 'Couldn’t sign in. Check your connection and try again.',
  };
}

/** Signs out on this device only; works offline. */
export async function signOut(db: Db): Promise<void> {
  await db.auth.signOut({ scope: 'local' });
}

export interface ManagedOutlet {
  id: string;
  name: string;
  code: string;
}

/** Outlets where the signed-in owner or manager may register a device. */
export async function listManagedOutlets(db: Db): Promise<ManagedOutlet[]> {
  const { data: session } = await db.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return [];

  const { data: memberships, error } = await db
    .from('memberships')
    .select('org_id, role, outlet_ids')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('role', ['owner', 'manager']);
  if (error) throw error;
  if (memberships.length === 0) return [];

  const { data: outlets, error: outletError } = await db
    .from('outlets')
    .select('id, name, code, org_id')
    .eq('is_active', true)
    .order('name')
    .limit(200);
  if (outletError) throw outletError;

  return outlets
    .filter((outlet) =>
      memberships.some(
        (m) =>
          m.org_id === outlet.org_id && (m.role === 'owner' || m.outlet_ids.includes(outlet.id)),
      ),
    )
    .map(({ id, name, code }) => ({ id, name, code }));
}

export async function registerDevice(
  db: Db,
  outletId: string,
  label: string,
): Promise<DeviceCredentials> {
  const { data, error } = await db.rpc('register_device', {
    p_outlet_id: outletId,
    p_label: label,
  });
  if (error) throw error;
  return DeviceCredentials.parse(data);
}

export async function fetchRoster(db: Db, device: DeviceCredentials): Promise<Roster> {
  const { data, error } = await db.rpc('device_roster', {
    p_device_id: device.deviceId,
    p_secret: device.secret,
  });
  if (error) {
    if (error.code === '28000') throw new DeviceNotRegisteredError();
    throw error;
  }
  return Roster.parse(data);
}

/** Exchanges a PIN for a real session through the auth-pin edge function. */
export async function pinLogin(
  db: Db,
  device: DeviceCredentials,
  membershipId: string,
  pin: string,
): Promise<PinLoginResult> {
  const invoked = await db.functions.invoke<unknown>('auth-pin', {
    body: { deviceId: device.deviceId, deviceSecret: device.secret, membershipId, pin },
  });
  const error: unknown = invoked.error;
  const data: unknown = invoked.data;
  if (error) {
    if (error instanceof FunctionsFetchError) return { ok: false, reason: 'offline' };
    throw error instanceof Error ? error : new Error('auth-pin failed');
  }

  const response = PinLoginResponse.parse(data);
  if (!response.ok) return response;

  const { error: sessionError } = await db.auth.setSession({
    access_token: response.accessToken,
    refresh_token: response.refreshToken,
  });
  if (sessionError) throw sessionError;
  return { ok: true };
}

/**
 * Checks a PIN against the cached roster hash, for switching cashiers while offline.
 * Weaker than the server check (no lockout, and the hash is on the device), so the caller
 * should also count failures locally.
 */
export function checkPinOffline(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}
