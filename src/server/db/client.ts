import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { requireDatabaseUrl } from '@/lib/env';
import * as schema from './schema';
const globalDb = globalThis as unknown as {
  linguaSql?: ReturnType<typeof postgres>;
};
export function getDb() {
  const client =
    globalDb.linguaSql ??
    postgres(requireDatabaseUrl(), {
      max: 1,
      prepare: false,
      connect_timeout: 10,
    });
  globalDb.linguaSql = client;
  return drizzle(client, { schema });
}
