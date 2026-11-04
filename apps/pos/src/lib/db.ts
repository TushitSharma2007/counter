import { createDb, readDbConfig } from '@repo/db';

export const db = createDb(readDbConfig(import.meta.env));
