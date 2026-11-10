// Adds a staff member. Only the server can create logins, so this function creates one, then
// calls add_staff *as the signed-in owner*, so the database's own checks decide whether they may.
// If that refuses, the new login is deleted again.
import { createClient } from '@supabase/supabase-js';
import {
  StaffCreateRequest,
  type StaffCreateResponse,
} from '../../../packages/db/src/contracts/staff.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const noSession = { persistSession: false, autoRefreshToken: false };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: StaffCreateResponse | { error: string }, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Readable but strong: 4 groups of 4 from an alphabet without look-alikes. */
function tempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{4}/g)?.join('-') ?? chars;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: noSession,
  });
  const { data: caller } = await asCaller.auth.getUser();
  if (!caller.user) return reply({ error: 'Sign in first' }, 401);

  const parsed = StaffCreateRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return reply({ ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }, 400);
  }
  const input = parsed.data;

  const admin = createClient(url, serviceKey, { auth: noSession });
  const password = input.email ? tempPassword() : `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    // PIN-only staff get an address nobody can receive mail at.
    email: input.email ?? `${crypto.randomUUID()}@staff.invalid`,
    password,
    email_confirm: true,
    app_metadata: { created_by: caller.user.id, kind: 'staff' },
  });
  if (createError || !created.user) {
    const taken = createError?.code === 'email_exists';
    return reply({
      ok: false,
      message: taken
        ? 'Someone already signs in with that email.'
        : 'Couldn\u2019t add them. Try again.',
    });
  }

  const { data: membershipId, error } = await asCaller.rpc('add_staff', {
    p: {
      userId: created.user.id,
      orgId: input.orgId,
      name: input.name,
      phone: input.phone,
      role: input.role,
      outletIds: input.outletIds,
      pin: input.pin,
    },
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    const known = error.code === '22023' || error.code === '42501';
    return reply({
      ok: false,
      message: known ? error.message : 'Couldn\u2019t add them. Try again.',
    });
  }

  return reply({
    ok: true,
    membershipId: membershipId as string,
    ...(input.email ? { tempPassword: password } : {}),
  });
});
