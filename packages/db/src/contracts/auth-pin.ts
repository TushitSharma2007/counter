// Request and response of the auth-pin edge function. Shared by the POS and the function
// (Deno), so this file imports nothing but zod.
import { z } from 'zod';

export const PinLoginRequest = z.object({
  deviceId: z.uuid(),
  deviceSecret: z.string().regex(/^[0-9a-f]{64}$/),
  membershipId: z.uuid(),
  pin: z.string().regex(/^[0-9]{4,6}$/),
});
export type PinLoginRequest = z.infer<typeof PinLoginRequest>;

export const PinLoginFailure = z.object({
  ok: z.literal(false),
  reason: z.enum(['device', 'not_here', 'wrong_pin', 'locked']),
  triesLeft: z.number().int().optional(),
  until: z.string().optional(),
});
export type PinLoginFailure = z.infer<typeof PinLoginFailure>;

export const PinLoginResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), accessToken: z.string(), refreshToken: z.string() }),
  PinLoginFailure,
]);
export type PinLoginResponse = z.infer<typeof PinLoginResponse>;
