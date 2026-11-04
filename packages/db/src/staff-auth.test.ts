import { FunctionsFetchError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from './client.ts';
import { checkPinOffline, pinLogin, type DeviceCredentials } from './staff-auth.ts';

// Produced by pgcrypto: crypt('1357', gen_salt('bf', 8)), exactly as set_staff_pin stores it.
const PGCRYPTO_HASH_1357 = '$2a$08$m7x7ce5EiEIQZlVrgpZxA.N69QudHzb3JxWUNOJIkTUWHlc8GmDum';

const device: DeviceCredentials = {
  deviceId: '309ffc72-69fb-4f41-8b4c-e01ceace4c8e',
  outletId: '0193a000-0000-7000-8000-000000000101',
  code: 'T1',
  label: 'Counter tablet',
  secret: 'a'.repeat(64),
};
const membershipId = '0193a000-0000-7000-8000-000000000301';

function fakeDb(invoke: () => Promise<{ data: unknown; error: unknown }>) {
  const setSession = vi.fn(() => Promise.resolve({ error: null }));
  const db = { functions: { invoke }, auth: { setSession } } as unknown as Db;
  return { db, setSession };
}

describe('checkPinOffline', () => {
  it('accepts the right PIN against a pgcrypto hash', async () => {
    expect(await checkPinOffline('1357', PGCRYPTO_HASH_1357)).toBe(true);
  });

  it('rejects a wrong PIN', async () => {
    expect(await checkPinOffline('1358', PGCRYPTO_HASH_1357)).toBe(false);
  });
});

describe('pinLogin', () => {
  it('starts the session returned by the server', async () => {
    const { db, setSession } = fakeDb(() =>
      Promise.resolve({ data: { ok: true, accessToken: 'at', refreshToken: 'rt' }, error: null }),
    );
    expect(await pinLogin(db, device, membershipId, '1357')).toEqual({ ok: true });
    expect(setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  });

  it('passes on why the server said no', async () => {
    const { db, setSession } = fakeDb(() =>
      Promise.resolve({ data: { ok: false, reason: 'wrong_pin', triesLeft: 3 }, error: null }),
    );
    expect(await pinLogin(db, device, membershipId, '0000')).toEqual({
      ok: false,
      reason: 'wrong_pin',
      triesLeft: 3,
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('reports offline when the request never reaches the server', async () => {
    const { db } = fakeDb(() =>
      Promise.resolve({
        data: null,
        error: new FunctionsFetchError(new TypeError('fetch failed')),
      }),
    );
    expect(await pinLogin(db, device, membershipId, '1357')).toEqual({
      ok: false,
      reason: 'offline',
    });
  });
});
