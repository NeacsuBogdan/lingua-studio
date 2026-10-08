import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import { seedEnglishCourse } from '../src/server/course/seed';
import { seedEnglishVocabulary } from '../src/server/vocabulary/seed';
import { seedEnglishWeaknesses } from '../src/server/mistakes/seed';
import { backfillMistakes } from '../src/server/mistakes/record';
import { advanceLesson, startLesson } from '../src/server/course/repository';
import { submitExercise } from '../src/server/exercises/repository';
import { submitMistakePractice } from '../src/server/mistakes/repository';
import {
  backfillEligibleCards,
  ensureReviewCard,
  startReviewSession,
  getReviewSession,
  submitReview,
} from '../src/server/review/repository';
import {
  getDailySession,
  startDailySession,
  getTodayDaily,
} from '../src/server/daily/repository';

it('preserves every Phase 0–7 table through additive migration, repeated seed/backfills and Daily lifecycle', async () => {
  const url = process.env.DAILY_TEST_DATABASE_URL;
  if (
    url &&
    (new URL(url).hostname !== '127.0.0.1' ||
      ![
        '/lingua_phase8_preservation',
        '/lingua_phase8_preservation_final',
      ].includes(new URL(url).pathname))
  )
    throw new Error(
      'Daily preservation requires its dedicated disposable loopback database',
    );
  const pg = url ? postgres(url, { max: 5 }) : null;
  const embedded = pg ? null : new PGlite();
  const exec = (text: string) => (pg ? pg.unsafe(text) : embedded!.exec(text));
  const query = async <T>(text: string): Promise<T[]> =>
    pg
      ? ((await pg.unsafe(text)) as unknown as T[])
      : (await embedded!.query<T>(text)).rows;
  const db = (pg
    ? pgDrizzle(pg, { schema })
    : drizzle(embedded!, { schema })) as unknown as ReturnType<typeof getDb>;
  const apply = async (tag: string) => {
    for (const statement of (
      await readFile(`drizzle/${tag}.sql`, 'utf8')
    ).split('--> statement-breakpoint'))
      if (statement.trim()) await exec(statement);
  };
  try {
    const journal = JSON.parse(
      await readFile('drizzle/meta/_journal.json', 'utf8'),
    ) as { entries: { tag: string }[] };
    for (const migration of journal.entries.slice(0, 8))
      await apply(migration.tag);
    await db.insert(schema.languages).values({ code: 'ro', name: 'Romanian' });
    await seedEnglishCourse(db);
    await seedEnglishVocabulary(db);
    await seedEnglishWeaknesses(db);
    const [user] = await db
      .insert(schema.users)
      .values({
        email: `${randomUUID()}@example.test`,
        name: 'Synthetic preservation learner',
      })
      .returning();
    await db.insert(schema.accounts).values({
      userId: user.id,
      providerId: 'github',
      accountId: 'phase8-local-fixture',
    });
    await db.insert(schema.sessions).values({
      userId: user.id,
      token: 'phase8-local-synthetic-token',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    await db.insert(schema.learnerProfiles).values({
      userId: user.id,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
      dailyMinutes: 5,
    });
    await startLesson(db, user.id, 'en-b1-present-perfect');
    await advanceLesson(db, user.id, 'en-b1-present-perfect', 0, 2);
    await submitExercise(db, user.id, 'en', {
      lessonId: 'en-b1-present-perfect',
      activityId: 'en-b1-present-perfect-choice',
      contentVersion: 2,
      submissionId: randomUUID(),
      answer: { type: 'multiple_choice', optionId: 'have-sent' },
    });
    const prior = new Date('2026-10-01T12:00:00Z');
    const practice = {
      weaknessId: 'en-past-present-perfect',
      activityId: 'en-b1-present-perfect-choice',
      contentVersion: 2,
      submissionId: randomUUID(),
      answer: { type: 'multiple_choice', optionId: 'have-sent' },
    };
    await submitMistakePractice(db, user.id, 'en', practice, prior);
    const senses = await db.select().from(schema.vocabularySenses).limit(6);
    for (const sense of senses)
      await ensureReviewCard(db, user.id, sense.id, prior);
    const reviewId = (await startReviewSession(db, user.id, 'en', prior))!;
    const rate = async (time: Date) => {
      const review = await getReviewSession(db, user.id, 'en', reviewId, time);
      const request = {
        sessionId: reviewId,
        itemId: review.current!.itemId,
        cardId: review.current!.cardId,
        submissionId: randomUUID(),
        rating: 'Again' as const,
      };
      await submitReview(db, user.id, 'en', request, time);
      return request;
    };
    await rate(prior);
    const tables = await query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(tables).toHaveLength(32);
    async function snapshot() {
      const state: Record<string, { count: number; sha256: string }> = {};
      for (const { table_name } of tables) {
        const rows = await query<{ value: string }>(
          `select to_jsonb(t)::text as value from "${table_name.replaceAll('"', '""')}" t order by to_jsonb(t)::text`,
        );
        state[table_name] = {
          count: rows.length,
          sha256: createHash('sha256')
            .update(rows.map((r) => r.value).join('\n'))
            .digest('hex'),
        };
      }
      return state;
    }
    const before = await snapshot();
    await apply(journal.entries[8].tag);
    expect(await query('select * from daily_sessions')).toHaveLength(0);
    expect(await query('select * from daily_session_items')).toHaveLength(0);
    for (let i = 0; i < 2; i++) {
      await seedEnglishCourse(db);
      await seedEnglishVocabulary(db);
      await seedEnglishWeaknesses(db);
      await backfillEligibleCards(db, prior);
      expect(await backfillMistakes(db)).toEqual({ created: 0 });
    }
    expect(await snapshot()).toEqual(before);
    const now = new Date('2030-01-02T12:00:00Z');
    expect((await getTodayDaily(db, user.id, now)).plan).toBeNull();
    expect(await query('select * from daily_sessions')).toHaveLength(0);
    const ids = await Promise.all([
      startDailySession(db, user.id, now),
      startDailySession(db, user.id, now),
      startDailySession(db, user.id, now),
    ]);
    expect(new Set(ids).size).toBe(1);
    const id = ids[0];
    const daily = await getDailySession(db, user.id, 'en', id, now);
    expect(daily.items.map((i) => i.kind)).toEqual([
      'review',
      'mistake',
      'lesson',
    ]);
    expect(await snapshot()).toEqual(before);
    const afterStart = new Date(now.getTime() + 1000);
    const target = daily.items.find((i) => i.kind === 'review')!.targetCount;
    for (let i = 0; i < target; i++) {
      const request = await rate(afterStart);
      await submitReview(db, user.id, 'en', request, afterStart);
    }
    await submitMistakePractice(
      db,
      user.id,
      'en',
      { ...practice, submissionId: randomUUID() },
      afterStart,
    );
    const lesson = daily.items.find((i) => i.kind === 'lesson')!;
    expect(lesson.targetPosition).toBe(2);
    await advanceLesson(db, user.id, lesson.lessonId!, 1, 2);
    const sourcesAfterWork = await snapshot();
    const completed = await getDailySession(db, user.id, 'en', id, afterStart);
    expect(completed.session.completedAt).toEqual(afterStart);
    expect(completed.items.every((i) => i.status === 'completed')).toBe(true);
    expect(
      await getDailySession(
        db,
        user.id,
        'en',
        id,
        new Date(afterStart.getTime() + 1000),
      ),
    ).toEqual(completed);
    expect(await startDailySession(db, user.id, afterStart)).toBe(id);
    expect(await snapshot()).toEqual(sourcesAfterWork);
    await seedEnglishCourse(db);
    await seedEnglishVocabulary(db);
    await seedEnglishWeaknesses(db);
    await backfillEligibleCards(db, afterStart);
    expect(await backfillMistakes(db)).toEqual({ created: 0 });
    expect(await getDailySession(db, user.id, 'en', id, afterStart)).toEqual(
      completed,
    );
    expect(await snapshot()).toEqual(sourcesAfterWork);
    const triggers = await query<{ trigger_name: string }>(
      "select trigger_name from information_schema.triggers where trigger_name like 'daily_%'",
    );
    expect(new Set(triggers.map((r) => r.trigger_name)).size).toBe(4);
    const indexes = await query(
      "select indexname from pg_indexes where tablename in ('daily_sessions','daily_session_items')",
    );
    expect(indexes).toHaveLength(6);
    await expect(
      db
        .update(schema.dailySessions)
        .set({ completedAt: null })
        .where(eq(schema.dailySessions.id, id)),
    ).rejects.toThrow();
  } finally {
    if (pg) await pg.end();
    else await embedded!.close();
  }
}, 60000);
