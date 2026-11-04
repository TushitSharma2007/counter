import { z } from 'zod';
import type { Db } from './client.ts';

const Health = z.object({ ok: z.literal(true) });

/** True when the database answers. Used by the sync indicator and the keep-alive job. */
export async function checkHealth(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc('health');
  return !error && Health.safeParse(data).success;
}
