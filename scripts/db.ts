import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { requireDatabaseUrl } from '../src/lib/env';
import { languages } from '../src/server/db/schema';
loadEnvConfig(process.cwd());
async function main() {
  const sql = postgres(requireDatabaseUrl(), { max: 1, connect_timeout: 10 });
  try {
    const db = drizzle(sql);
    const command = process.argv[2];
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
