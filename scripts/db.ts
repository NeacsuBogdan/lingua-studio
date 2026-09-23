import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { requireDatabaseUrl } from '../src/lib/env';
import { databaseTlsOptions } from '../src/lib/database-tls';
import { languages } from '../src/server/db/schema';
nextEnv.loadEnvConfig(process.cwd());
async function main() {
  const command = process.argv[2];
  if (!['check', 'inspect', 'migrate', 'seed'].includes(command)) {
    throw new Error('Unknown database command.');
  }
  const url = requireDatabaseUrl();
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    ...databaseTlsOptions(url),
  });
  try {
    const db = drizzle(sql);
    if (command === 'migrate') {
      await migrate(db, { migrationsFolder: 'drizzle' });
      console.log('Migrations applied.');
    } else if (command === 'seed') {
      await db
        .insert(languages)
        .values([
          { code: 'en', name: 'English' },
          { code: 'ro', name: 'Romanian' },
          { code: 'ja', name: 'Japanese' },
          { code: 'es', name: 'Spanish' },
          { code: 'it', name: 'Italian' },
        ])
        .onConflictDoNothing();
      console.log('Language reference data seeded.');
    } else if (command === 'inspect') {
      const [connection] = await sql`
        select current_database() as database,
          current_setting('server_version') as version
      `;
      const tables = await sql`
        select table_schema, table_name from information_schema.tables
        where table_schema in ('public', 'drizzle')
        order by table_schema, table_name
      `;
      console.log(
        'Database inspection (read-only; no credentials or row data):',
      );
      console.log(connection);
      console.log('Client TLS policy:', databaseTlsOptions(url));
      console.log('Existing application/migration tables:', tables);
    } else {
      await sql`select 1`;
      console.log('PostgreSQL connection verified.');
    }
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    'Database operation failed. Check DATABASE_URL, network access, and migration prerequisites. Credentials are never logged.',
  );
  process.exitCode = 1;
});
