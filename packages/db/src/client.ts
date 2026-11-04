import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/types';
import type { DbConfig } from './env.ts';

export type Db = SupabaseClient<Database>;

/** The one place a Supabase client is created. Feature code receives a `Db`, never the SDK. */
export function createDb(config: DbConfig): Db {
  return createClient<Database>(config.url, config.publishableKey);
}
