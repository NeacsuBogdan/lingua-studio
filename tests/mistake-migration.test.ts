import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import { seedEnglishWeaknesses } from '../src/server/mistakes/seed';
import { backfillMistakes } from '../src/server/mistakes/record';
import {
  backfillEligibleCards,
  startReviewSession,
  getReviewSession,
  submitReview,
} from '../src/server/review/repository';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import { seedEnglishCourse } from '../src/server/course/seed';
import { seedEnglishVocabulary } from '../src/server/vocabulary/seed';

async function apply(
  client: { exec: (s: string) => Promise<unknown> },
  file: string,
) {
  const sql = await readFile(`drizzle/${file}.sql`, 'utf8');
  for (const statement of sql.split('--> statement-breakpoint'))
    if (statement.trim()) await client.exec(statement);
}

it('adds and backfills mistakes without changing Phase 0–6 rows', async () => {
  const url = process.env.MISTAKE_TEST_DATABASE_URL;
  if (
    url &&
    (new URL(url).hostname !== '127.0.0.1' ||
      new URL(url).pathname !== '/lingua_phase7_preservation')
  )
    throw new Error(
      'Preservation tests require the dedicated disposable loopback database',
    );
  const pg = url ? postgres(url, { max: 1 }) : null;
  const embedded = pg ? null : new PGlite();
  const client = {
    exec: async (text: string) => (pg ? pg.unsafe(text) : embedded!.exec(text)),
    query: async <T>(text: string): Promise<{ rows: T[] }> =>
      pg
        ? { rows: (await pg.unsafe(text)) as unknown as T[] }
        : embedded!.query<T>(text),
    close: async () => {
      if (pg) await pg.end();
      else await embedded!.close();
    },
  };
  try {
    const journal = JSON.parse(
      await readFile('drizzle/meta/_journal.json', 'utf8'),
    ) as {
      entries: { tag: string }[];
    };
    for (const migration of journal.entries.slice(0, 7))
      await apply(client, migration.tag);
    const local = (pg
      ? pgDrizzle(pg, { schema })
      : drizzle(embedded!, { schema })) as unknown as ReturnType<typeof getDb>;
    const db = local as unknown as ReturnType<typeof getDb>;
    await local
      .insert(schema.languages)
      .values({ code: 'ro', name: 'Romanian' });
    await seedEnglishCourse(db);
    await seedEnglishVocabulary(db);
    const [user] = await local
      .insert(schema.users)
      .values({ email: `${randomUUID()}@example.test` })
      .returning({ id: schema.users.id });
    await local.insert(schema.accounts).values({
      userId: user.id,
      providerId: 'github',
      accountId: 'local-review-fixture',
    });
    await local.insert(schema.sessions).values({
      userId: user.id,
      token: 'local-review-fixture-token',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    await local.insert(schema.learnerProfiles).values({
      userId: user.id,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
    });
    await local.insert(schema.lessonProgress).values({
      userId: user.id,
      lessonId: 'en-b1-present-perfect',
      contentVersion: 2,
      status: 'completed',
      position: 5,
      completedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const [attempt] = await local
      .insert(schema.exerciseAttempts)
      .values({
        userId: user.id,
        lessonId: 'en-b1-present-perfect',
        activityId: 'en-b1-present-perfect-choice',
        contentVersion: 2,
        submissionId: randomUUID(),
        submittedAnswer: { type: 'multiple_choice', optionId: 'sent' },
        result: {
          isCorrect: false,
          score: 0,
          expectedAnswer: 'sent',
          explanation: 'Local fixture',
          feedback: 'Correct',
        },
        isCorrect: false,
        score: 0,
      })
      .returning({ id: schema.exerciseAttempts.id });
    await local.insert(schema.userVocabulary).values({
      userId: user.id,
      senseId: 'en-decision-noun-1',
      introducedAt: new Date('2026-01-01T00:00:00Z'),
      savedAt: new Date('2026-01-02T00:00:00Z'),
    });
    await local.insert(schema.vocabularyEvidence).values({
      userId: user.id,
      attemptId: attempt.id,
      senseId: 'en-decision-noun-1',
      isCorrect: false,
      score: 0,
    });

    async function snapshot() {
      const tables = (
        await client.query<{ table_name: string }>(
          "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
        )
      ).rows;
      const state: Record<string, unknown> = {};
      for (const { table_name } of tables) {
        const identifier = `"${table_name.replaceAll('"', '""')}"`;
        const [row] = (
          await client.query<{ total: number; fingerprint: string }>(
            `select count(*)::integer as total, md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text), '')) as fingerprint from ${identifier} t`,
          )
        ).rows;
        state[table_name] = row;
      }
      return state;
    }
    const now = new Date('2026-09-01T12:00:00Z');
    await backfillEligibleCards(db, now);
    const sessionId = (await startReviewSession(db, user.id, 'en', now))!;
    const review = await getReviewSession(db, user.id, 'en', sessionId, now);
    await submitReview(
      db,
      user.id,
      'en',
      {
        sessionId,
        itemId: review.current!.itemId,
        cardId: review.current!.cardId,
        submissionId: randomUUID(),
        rating: 'Again',
      },
      now,
    );
    const before = await snapshot();
    await apply(client, journal.entries[7].tag);
    await seedEnglishCourse(db);
    await seedEnglishVocabulary(db);
    await seedEnglishWeaknesses(db);
    expect(await backfillMistakes(db)).toEqual({ created: 1 });
    await seedEnglishCourse(db);
    await seedEnglishVocabulary(db);
    await seedEnglishWeaknesses(db);
    expect(await backfillMistakes(db)).toEqual({ created: 0 });
    const after = await snapshot();
    for (const [table, state] of Object.entries(before))
      expect(after[table]).toEqual(state);
    expect(await local.select().from(schema.mistakeOccurrences)).toHaveLength(
      1,
    );
    expect(await local.select().from(schema.reviewHistory)).toHaveLength(1);
    expect(
      await local.select().from(schema.mistakePracticeAttempts),
    ).toHaveLength(0);
  } finally {
    await client.close();
  }
}, 30000);
