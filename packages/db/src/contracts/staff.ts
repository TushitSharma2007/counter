// Request and response of the staff-create edge function. Shared by the POS form and the function
// (Deno), so this file imports nothing but zod.
import { z } from 'zod';

export const STAFF_ROLES = ['manager', 'cashier', 'kitchen'] as const;

export const StaffCreateRequest = z.object({
  orgId: z.uuid(),
  name: z.string().trim().min(1, 'Give their name').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'Use a 10-digit mobile number')
    .optional(),
  role: z.enum(STAFF_ROLES),
  outletIds: z.array(z.uuid()).min(1, 'Pick at least one outlet'),
  pin: z
    .string()
    .regex(/^\d{4}$/, 'PINs are 4 digits')
    .optional(),
  /** Managers who also sign in with email (back office). */
  email: z.email('That doesn\u2019t look like an email').optional(),
});
export type StaffCreateRequest = z.input<typeof StaffCreateRequest>;

export const StaffCreateResponse = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    membershipId: z.uuid(),
    /** Shown to the owner once, when an email sign-in was created. */
    tempPassword: z.string().optional(),
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type StaffCreateResponse = z.infer<typeof StaffCreateResponse>;
