// Cashier PIN login (CLAUDE.md §4). A registered device sends who tapped and the PIN they typed;
// if verify_staff_pin accepts it, we mint a normal Supabase session for that staff member by
// issuing a magic-link token and exchanging it here. No email is sent and no JWT is hand-signed.
import { createClient } from '@supabase/supabase-js';
import {
  PinLoginRequest,
  PinLoginFailure,
  type PinLoginResponse,
} from '../../../packages/db/src/contracts/auth-pin.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: PinLoginResponse | { error: string }, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);

  const parsed = PinLoginRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ error: 'Bad request' }, 400);
  const { deviceId, deviceSecret, membershipId, pin } = parsed.data;

  const admin = createClient(url, serviceKey, noSession);
  const { data, error } = await admin.rpc('verify_staff_pin', {
    p_device_id: deviceId,
    p_secret: deviceSecret,
    p_membership_id: membershipId,
    p_pin: pin,
  });
  if (error) {
    console.error('verify_staff_pin failed', error.message);
    return reply({ error: 'Could not check the PIN' }, 500);
  }

  const failure = PinLoginFailure.safeParse(data);
  if (failure.success) return reply(failure.data);

  const email = (data as { email?: unknown }).email;
  if (typeof email !== 'string') return reply({ error: 'Staff member has no login' }, 500);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError) {
    console.error('generateLink failed', linkError.message);
    return reply({ error: 'Could not start the session' }, 500);
  }

  const { data: verified, error: otpError } = await createClient(
    url,
    anonKey,
    noSession,
  ).auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  });
  if (otpError || !verified.session) {
    console.error('verifyOtp failed', otpError?.message);
    return reply({ error: 'Could not start the session' }, 500);
  }

  return reply({
    ok: true,
    accessToken: verified.session.access_token,
    refreshToken: verified.session.refresh_token,
  });
});
