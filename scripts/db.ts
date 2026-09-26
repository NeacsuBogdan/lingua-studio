import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { requireDatabaseUrl } from '../src/lib/env';
import { databaseTlsOptions } from '../src/lib/database-tls';
import * as schema from '../src/server/db/schema';
import { seedEnglishCourse } from '../src/server/course/seed';
import { sql as sqlExpression } from 'drizzle-orm';
nextEnv.loadEnvConfig(process.cwd());
async function main() {
  const command = process.argv[2];
  if (!['check', 'inspect', 'migrate', 'seed', 'verify'].includes(command)) {
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
    const db = drizzle(sql, { schema });
    if (command === 'migrate') {
      await migrate(db, { migrationsFolder: 'drizzle' });
      console.log('Migrations applied.');
    } else if (command === 'seed') {
      await db
        .insert(schema.languages)
        .values([
          {
            code: 'ro',
            name: 'Romanian',
            nativeName: 'Română',
            writingDirection: 'ltr',
            isActive: false,
          },
          {
            code: 'ja',
            name: 'Japanese',
            nativeName: '日本語',
            writingDirection: 'ltr',
            isActive: false,
          },
          {
            code: 'es',
            name: 'Spanish',
            nativeName: 'Español',
            writingDirection: 'ltr',
            isActive: false,
          },
          {
            code: 'it',
            name: 'Italian',
            nativeName: 'Italiano',
            writingDirection: 'ltr',
            isActive: false,
          },
        ])
        .onConflictDoUpdate({
          target: schema.languages.code,
          set: {
            name: sqlExpression`excluded.name`,
            nativeName: sqlExpression`excluded.native_name`,
            writingDirection: sqlExpression`excluded.writing_direction`,
          },
        });
      await seedEnglishCourse(db);
      console.log('Language reference data and English course seeded.');
    } else if (command === 'verify') {
      const [summary] = await sql`
        select
          (select count(*)::integer from learner_profiles) as profiles,
          (select count(*)::integer from users where email like 'phase3-e2e-%@example.test' or email like 'phase4-e2e-%@example.test') as test_fixtures,
          (select count(*)::integer from exercise_attempts) as attempts,
          (select count(distinct type)::integer from lesson_activities where type not in ('explanation', 'reflection')) as exercise_types,
          (select count(*)::integer from lessons where content_version <> 2) as outdated_lessons,
          (select count(*)::integer from courses where id = 'english-core' and language_code = 'en') as courses,
          (select count(*)::integer from course_levels where course_id = 'english-core') as levels,
          (select count(*)::integer from units u join course_levels l on l.id = u.course_level_id where l.course_id = 'english-core') as units,
          (select count(*)::integer from lessons x join units u on u.id = x.unit_id join course_levels l on l.id = u.course_level_id where l.course_id = 'english-core') as lessons,
          (select count(*)::integer from lesson_activities a join lessons x on x.id = a.lesson_id join units u on u.id = x.unit_id join course_levels l on l.id = u.course_level_id where l.course_id = 'english-core') as activities,
          (select count(*)::integer from lesson_prerequisites p join lessons x on x.id = p.lesson_id join units u on u.id = x.unit_id join course_levels l on l.id = u.course_level_id where l.course_id = 'english-core') as prerequisites
      `;
      if (
        summary.test_fixtures !== 0 ||
        summary.courses !== 1 ||
        summary.levels !== 6 ||
        summary.units !== 3 ||
        summary.lessons !== 5 ||
        summary.activities !== 18 ||
        summary.exercise_types !== 7 ||
        summary.outdated_lessons !== 0 ||
        summary.prerequisites !== 4
      ) {
        throw new Error('Unexpected published course database state');
      }
      console.log('Course database verification (counts only):', summary);
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
