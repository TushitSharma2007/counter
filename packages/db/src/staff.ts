// Staff and devices, as the owner (or a manager, for their own outlets) manages them.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Db } from './client.ts';
import { StaffCreateResponse, type StaffCreateRequest } from './contracts/staff.ts';
import { DeviceCredentials } from './staff-auth.ts';

export const StaffMember = z.object({
  membershipId: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['owner', 'manager', 'cashier', 'kitchen', 'loyalty_staff']),
  outletIds: z.array(z.uuid()),
  isActive: z.boolean(),
  hasPin: z.boolean(),
  emailLogin: z.boolean(),
  email: z.string().nullable(),
});
export type StaffMember = z.infer<typeof StaffMember>;

/** A database refusal with words meant for people (our functions raise those as 22023/42501/28000). */
export class FriendlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendlyError';
  }
}

function friendly(error: { code?: string; message: string }): Error {
  return ['22023', '42501', '28000'].includes(error.code ?? '')
    ? new FriendlyError(error.message)
    : new Error(error.message);
}

export async function listStaff(db: Db, orgId: string): Promise<StaffMember[]> {
  const { data, error } = await db.rpc('list_staff', { p_org_id: orgId });
  if (error) throw friendly(error);
  return z.array(StaffMember).parse(data);
}

export async function createStaff(
  db: Db,
  input: StaffCreateRequest,
): Promise<{ membershipId: string; tempPassword?: string }> {
  const invoked = await db.functions.invoke<unknown>('staff-create', { body: input });
  let body: unknown = invoked.data;
  const error: unknown = invoked.error;
  if (error instanceof FunctionsHttpError) {
    body = await (error.context as Response).json().catch(() => null);
  } else if (error) {
    throw new FriendlyError('Couldn’t reach the server. Check your connection and try again.');
  }
  const response = StaffCreateResponse.safeParse(body);
  if (!response.success) throw new Error('Unexpected reply from staff-create');
  if (!response.data.ok) throw new FriendlyError(response.data.message);
  return {
    membershipId: response.data.membershipId,
    ...(response.data.tempPassword ? { tempPassword: response.data.tempPassword } : {}),
  };
}

export async function updateStaff(
  db: Db,
  change: {
    membershipId: string;
    name?: string;
    phone?: string | null;
    role?: 'manager' | 'cashier';
    outletIds?: string[];
    isActive?: boolean;
  },
): Promise<void> {
  const { error } = await db.rpc('update_staff', { p: change });
  if (error) throw friendly(error);
}

export async function setStaffPin(db: Db, membershipId: string, pin: string): Promise<void> {
  const { error } = await db.rpc('set_staff_pin', { p_membership_id: membershipId, p_pin: pin });
  if (error) throw friendly(error);
}

export interface DeviceRow {
  id: string;
  outletId: string;
  code: string;
  label: string;
  kind: 'counter' | 'personal';
  /** Whose phone, for personal devices. */
  ownerName: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Counter tablets and people's phones at the outlets the caller manages. */
export async function listDevices(db: Db): Promise<DeviceRow[]> {
  const { data, error } = await db
    .from('devices')
    .select(
      'id, outlet_id, code, label, kind, last_seen_at, revoked_at, created_at, owner:profiles!devices_user_id_fkey (full_name)',
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    outletId: d.outlet_id,
    code: d.code,
    label: d.label,
    kind: d.kind === 'personal' ? 'personal' : 'counter',
    ownerName: d.owner?.full_name ?? null,
    lastSeenAt: d.last_seen_at,
    revokedAt: d.revoked_at,
    createdAt: d.created_at,
  }));
}

export async function revokeDevice(db: Db, deviceId: string): Promise<void> {
  const { error } = await db.rpc('revoke_device', { p_device_id: deviceId });
  if (error) throw friendly(error);
}

export const PairingCode = z.object({ code: z.string().length(8), expiresAt: z.string() });
export type PairingCode = z.infer<typeof PairingCode>;

/** A one-time code (10 minutes) that a tablet types in to become a counter at this outlet. */
export async function createPairingCode(
  db: Db,
  outletId: string,
  label: string,
): Promise<PairingCode> {
  const { data, error } = await db.rpc('create_pairing_code', {
    p_outlet_id: outletId,
    p_label: label,
  });
  if (error) throw friendly(error);
  return PairingCode.parse(data);
}

/** On the tablet, before anyone signs in: turns a pairing code into this tablet's credentials. */
export async function pairDevice(db: Db, code: string): Promise<DeviceCredentials> {
  const { data, error } = await db.rpc('pair_device', { p_code: code });
  if (error) throw friendly(error);
  return DeviceCredentials.parse(data);
}

/** "K7M2QX9P" → "K7M2-QX9P", for showing and typing codes. */
export function formatPairingCode(code: string): string {
  const clean = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
