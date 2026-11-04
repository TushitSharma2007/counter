import { z } from 'zod';

export interface DbConfig {
  url: string;
  publishableKey: string;
}

/** Legacy anon keys are JWTs; anything else in that format (service_role) is a secret. */
function jwtRole(token: string): unknown {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: unknown }).role;
  } catch {
    return undefined;
  }
}

const publishableKey = z
  .string()
  .min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY is missing')
  .refine(
    (key) => !key.startsWith('sb_secret_'),
    'That is a secret key. Never ship it to a browser.',
  )
  .refine(
    (key) => key.startsWith('sb_publishable_') || jwtRole(key) === 'anon',
    'Use the publishable key (sb_publishable_…) or the legacy anon key.',
  );

const DbEnv = z.object({
  VITE_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    error: 'VITE_SUPABASE_URL must be an http(s) URL',
  }),
  VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
});

/** Reads and checks the Supabase settings from an app's env (`import.meta.env`). */
export function readDbConfig(env: Record<string, unknown>): DbConfig {
  const parsed = DbEnv.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Supabase config: ${problems}. Check the app's .env.local.`);
  }
  return {
    url: parsed.data.VITE_SUPABASE_URL,
    publishableKey: parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
