import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import { seedEnglishCourse } from '../src/server/course/seed';
import {
  advanceLesson,
  getCourseMap,
  startLesson,
} from '../src/server/course/repository';
import {
  latestAttempt,
  submitExercise,
} from '../src/server/exercises/repository';

const client = new PGlite();
const local = drizzle(client, { schema });
const db = local as unknown as ReturnType<typeof getDb>;
let userId: string;
const lessonId = 'en-b1-present-perfect';
const activityId = `${lessonId}-choice`;
const request = (optionId = 'sent') => ({
  submissionId: randomUUID(),
  lessonId,
  activityId,
  contentVersion: 2,
  answer: { type: 'multiple_choice', optionId },
});
beforeAll(async () => {
  await migrate(local, { migrationsFolder: 'drizzle' });
  await local.insert(schema.languages).values({ code: 'ro', name: 'Romanian' });
}, 30000);
beforeEach(async () => {
  await seedEnglishCourse(db);
  const [user] = await local
    .insert(schema.users)
    .values({ email: `${randomUUID()}@example.test` })
    .returning();
  userId = user.id;
  await startLesson(db, userId, lessonId);
  await advanceLesson(db, userId, lessonId, 0, 2);
});
afterAll(async () => {
  await client.close();
});
it('keeps attempts immutable, persists useful feedback and isolates their owner', async () => {
  const first = await submitExercise(db, userId, 'en', request('have-sent'));
  const second = await submitExercise(db, userId, 'en', request());
  expect(first.isCorrect).toBe(false);
  expect(second.isCorrect).toBe(true);
  const rows = await local
    .select()
    .from(schema.exerciseAttempts)
    .where(eq(schema.exerciseAttempts.userId, userId));
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.id === first.attemptId)?.result).toMatchObject({
    isCorrect: false,
  });
  expect(rows[0].createdAt).toBeInstanceOf(Date);
  expect((await latestAttempt(db, userId, activityId, 2))?.result).toEqual(
    second,
  );
  expect(await latestAttempt(db, randomUUID(), activityId, 2)).toBeNull();
  await expect(
    local
      .update(schema.exerciseAttempts)
      .set({ isCorrect: true })
      .where(eq(schema.exerciseAttempts.id, first.attemptId)),
  ).rejects.toThrow();
});
it('deduplicates concurrent transport replays but rejects changed requests with the same ID', async () => {
  const payload = request();
  const [first, replay] = await Promise.all([
    submitExercise(db, userId, 'en', payload),
    submitExercise(db, userId, 'en', payload),
  ]);
  expect(first.attemptId).toBe(replay.attemptId);
  expect(
    await local
      .select()
      .from(schema.exerciseAttempts)
      .where(eq(schema.exerciseAttempts.userId, userId)),
  ).toHaveLength(1);
  await expect(
    submitExercise(db, userId, 'en', {
      ...payload,
      answer: { type: 'multiple_choice', optionId: 'send' },
    }),
  ).rejects.toMatchObject({ code: 'invalid' });
});
it('deduplicates text replays after JSONB reorders object keys', async () => {
  await submitExercise(db, userId, 'en', request());
  await advanceLesson(db, userId, lessonId, 1, 2);
  const payload = {
    submissionId: randomUUID(),
    lessonId,
    activityId: `${lessonId}-gap`,
    contentVersion: 2,
    answer: { type: 'fill_gap', text: 'have lived' },
  };
  const first = await submitExercise(db, userId, 'en', payload);
  const replay = await submitExercise(db, userId, 'en', payload);
  expect(replay.attemptId).toBe(first.attemptId);
  expect(
    await local
      .select()
      .from(schema.exerciseAttempts)
      .where(eq(schema.exerciseAttempts.userId, userId)),
  ).toHaveLength(2);
});
it('rejects forged identity, malformed answer, lesson/activity mismatch, stale version and locked lesson', async () => {
  await expect(
    submitExercise(db, userId, 'en', { ...request(), userId: randomUUID() }),
  ).rejects.toMatchObject({ code: 'invalid' });
  await expect(
    submitExercise(db, userId, 'en', {
      ...request(),
      answer: { type: 'translation', text: 'Forged' },
    }),
  ).rejects.toThrow();
  await expect(
    submitExercise(db, userId, 'en', request('unknown')),
  ).rejects.toThrow();
  await expect(
    submitExercise(db, userId, 'en', {
      ...request(),
      activityId: 'en-b1-narrative-typed',
    }),
  ).rejects.toMatchObject({ code: 'not_current' });
  await expect(
    submitExercise(db, userId, 'en', { ...request(), contentVersion: 1 }),
  ).rejects.toMatchObject({ code: 'stale' });
  await expect(
    submitExercise(db, userId, 'en', {
      ...request(),
      lessonId: 'en-b1-narrative',
      activityId: 'en-b1-narrative-reorder',
    }),
  ).rejects.toMatchObject({ code: 'not_current' });
  await expect(submitExercise(db, userId, 'ja', request())).rejects.toThrow();
  expect(
    await local
      .select()
      .from(schema.exerciseAttempts)
      .where(eq(schema.exerciseAttempts.userId, userId)),
  ).toHaveLength(0);
});
it('requires an actual attempt to traverse an exercise and keeps correctness separate from progression', async () => {
  await expect(advanceLesson(db, userId, lessonId, 1, 2)).rejects.toMatchObject(
    { code: 'answer_required' },
  );
  const result = await submitExercise(db, userId, 'en', request('have-sent'));
  expect(result.isCorrect).toBe(false);
  expect((await advanceLesson(db, userId, lessonId, 1, 2)).position).toBe(2);
  await expect(advanceLesson(db, userId, lessonId, 1, 2)).rejects.toMatchObject(
    { code: 'stale' },
  );
  await expect(
    submitExercise(db, userId, 'en', request()),
  ).rejects.toMatchObject({ code: 'not_current' });
});
it('retains earlier attempt snapshots when content changes and starts the new version cleanly', async () => {
  await submitExercise(db, userId, 'en', request());
  await local
    .update(schema.lessons)
    .set({ contentVersion: 3 })
    .where(eq(schema.lessons.id, lessonId));
  expect((await getCourseMap(db, userId, 'en'))?.recommended?.state).toBe(
    'available',
  );
  await expect(
    submitExercise(db, userId, 'en', request()),
  ).rejects.toMatchObject({ code: 'stale' });
  expect(await latestAttempt(db, userId, activityId, 3)).toBeNull();
  expect((await startLesson(db, userId, lessonId)).position).toBe(0);
  expect(
    await local
      .select()
      .from(schema.exerciseAttempts)
      .where(eq(schema.exerciseAttempts.userId, userId)),
  ).toHaveLength(1);
});
it('preserves the prior-version profile and progress through repeat migration and seed', async () => {
  await local.insert(schema.learnerProfiles).values({
    userId,
    nativeLanguage: 'ro',
    learningLanguage: 'en',
    dailyMinutes: 45,
  });
  await local
    .update(schema.lessonProgress)
    .set({
      contentVersion: 1,
      status: 'completed',
      position: 2,
      completedAt: new Date(),
    })
    .where(eq(schema.lessonProgress.userId, userId));
  const before = await local
    .select()
    .from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.userId, userId));
  await migrate(local, { migrationsFolder: 'drizzle' });
  await seedEnglishCourse(db);
  await seedEnglishCourse(db);
  expect(
    await local
      .select()
      .from(schema.lessonProgress)
      .where(eq(schema.lessonProgress.userId, userId)),
  ).toEqual(before);
  expect(
    (
      await local
        .select()
        .from(schema.learnerProfiles)
        .where(eq(schema.learnerProfiles.userId, userId))
    )[0].dailyMinutes,
  ).toBe(45);
  expect(await local.select().from(schema.lessonActivities)).toHaveLength(18);
});
