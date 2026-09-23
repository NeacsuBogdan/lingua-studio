import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { requireDatabaseUrl } from '@/lib/env';
import { databaseTlsOptions } from '@/lib/database-tls';
import * as schema from './schema';
const globalDb = globalThis as unknown as {
  linguaSql?: ReturnType<typeof postgres>;
};
export function getDb() {
  const url = requireDatabaseUrl();
  const client =
    globalDb.linguaSql ??
    postgres(url, {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      ...databaseTlsOptions(url),
    });
  globalDb.linguaSql = client;
  return drizzle(client, { schema });
}
