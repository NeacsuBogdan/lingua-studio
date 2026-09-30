import { seedEnglishWeaknesses } from '../src/server/mistakes/seed';
import { backfillMistakes } from '../src/server/mistakes/record';
import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { requireDatabaseUrl } from '../src/lib/env';
import { databaseTlsOptions } from '../src/lib/database-tls';
import * as schema from '../src/server/db/schema';
import { seedEnglishCourse } from '../src/server/course/seed';
import { seedEnglishVocabulary } from '../src/server/vocabulary/seed';
import { backfillEligibleCards } from '../src/server/review/repository';
import { sql as sqlExpression } from 'drizzle-orm';
nextEnv.loadEnvConfig(process.cwd());
async function main() {
  const command = process.argv[2];
  if (
    ![
      'check',
      'inspect',
      'migrate',
      'seed',
      'review-backfill',
      'mistake-backfill',
      'verify',
    ].includes(command)
  ) {
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
      await seedEnglishVocabulary(db);
      await seedEnglishWeaknesses(db);
      console.log(
        'Language reference data, English course and vocabulary seeded.',
      );
    } else if (command === 'mistake-backfill') {
      console.log(
        'Mistake evidence backfilled (counts only):',
        await backfillMistakes(db),
      );
    } else if (command === 'review-backfill') {
      const result = await backfillEligibleCards(db, new Date());
      console.log('Eligible review cards backfilled (counts only):', result);
    } else if (command === 'verify') {
      const [summary] = await sql`
        select
          (select count(*)::integer from weakness_definitions) as weaknesses,
          (select count(*)::integer from activity_weaknesses where is_published) as weakness_mappings,
          (select count(*)::integer from mistake_occurrences) as mistake_occurrences,
          (select count(*)::integer from mistake_practice_attempts) as mistake_practice_attempts,
          (select count(*)::integer from exercise_attempts a join activity_weaknesses m on m.activity_id = a.activity_id and m.content_version = a.content_version left join mistake_occurrences o on o.attempt_id = a.id and o.weakness_id = m.weakness_id where not a.is_correct and o.id is null) as missing_mistakes,
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
          ,(select count(*)::integer from vocabulary_senses where language_code = 'en' and is_published) as vocabulary_senses
          ,(select count(*)::integer from vocabulary_examples) as vocabulary_examples
          ,(select count(*)::integer from vocabulary_collocations) as vocabulary_collocations
          ,(select count(*)::integer from vocabulary_families) as vocabulary_families
          ,(select count(*)::integer from activity_vocabulary) as vocabulary_links
          ,(select count(*)::integer from review_cards) as review_cards
          ,(select count(*)::integer from review_history) as review_history
          ,(select count(*)::integer from (select user_id, sense_id from user_vocabulary where introduced_at is not null union select user_id, sense_id from vocabulary_evidence) eligible left join review_cards c on c.user_id = eligible.user_id and c.sense_id = eligible.sense_id and c.kind = 'recognition' where c.id is null) as missing_review_cards
      `;
      if (
        summary.weaknesses !== 5 ||
        summary.weakness_mappings !== 8 ||
        summary.missing_mistakes !== 0 ||
        summary.test_fixtures !== 0 ||
        summary.courses !== 1 ||
        summary.levels !== 6 ||
        summary.units !== 3 ||
        summary.lessons !== 5 ||
        summary.activities !== 18 ||
        summary.exercise_types !== 7 ||
        summary.outdated_lessons !== 0 ||
        summary.prerequisites !== 4 ||
        summary.vocabulary_senses !== 16 ||
        summary.vocabulary_examples !== 16 ||
        summary.vocabulary_collocations !== 4 ||
        summary.vocabulary_families !== 5 ||
        summary.vocabulary_links !== 13 ||
        summary.missing_review_cards !== 0
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
