import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import { seedEnglishCourse } from '../src/server/course/seed';
import { seedEnglishVocabulary } from '../src/server/vocabulary/seed';
import { seedEnglishWeaknesses } from '../src/server/mistakes/seed';
import {
  backfillMistakes,
  recordMistakes,
} from '../src/server/mistakes/record';
import {
  attentionState,
  getMistakePractice,
  listWeaknesses,
  recentMistakes,
  submitMistakePractice,
} from '../src/server/mistakes/repository';
import { submitExercise } from '../src/server/exercises/repository';
import { advanceLesson, startLesson } from '../src/server/course/repository';
import { englishWeaknesses } from '../src/content/en/weaknesses';
import { englishCatalog } from '../src/content/en/course';
import { validateWeaknessCatalog } from '../src/content/weakness-schema';

const client = new PGlite();
const local = drizzle(client, { schema });
const db = local as unknown as ReturnType<typeof getDb>;
const weaknessId = 'en-past-present-perfect';
const lessonId = 'en-b1-present-perfect';
const activityId = `${lessonId}-choice`;
let userId: string;
const at = (day: number) =>
  new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00Z`);
const request = (optionId = 'have-sent') => ({
  submissionId: randomUUID(),
  weaknessId,
  activityId,
  contentVersion: 2,
  answer: { type: 'multiple_choice', optionId },
});
async function historical(correct = false, time = at(1), owner = userId) {
  const [a] = await local
    .insert(schema.exerciseAttempts)
    .values({
      userId: owner,
      lessonId,
      activityId,
      contentVersion: 2,
      submissionId: randomUUID(),
      submittedAnswer: {
        type: 'multiple_choice',
        optionId: correct ? 'sent' : 'have-sent',
      },
      result: {
        isCorrect: correct,
        score: correct ? 1 : 0,
        expectedAnswer: 'I sent the email yesterday.',
        explanation: 'Finished past time.',
        feedback: 'Saved feedback',
      },
      isCorrect: correct,
      score: correct ? 1 : 0,
      createdAt: time,
    })
    .returning();
  return a;
}
beforeAll(async () => {
  await migrate(local, { migrationsFolder: 'drizzle' });
  await seedEnglishCourse(db);
  await seedEnglishVocabulary(db);
  await seedEnglishWeaknesses(db);
}, 30000);
beforeEach(async () => {
  const [u] = await local
    .insert(schema.users)
    .values({ email: `${randomUUID()}@example.test` })
    .returning();
  userId = u.id;
});
afterAll(async () => {
  await client.close();
});

it('validates stable editorial identities, language, skill and graded targets', () => {
  expect(
    validateWeaknessCatalog(englishWeaknesses, englishCatalog).definitions,
  ).toHaveLength(5);
  const invalid = (change: (c: typeof englishWeaknesses) => void) => {
    const c = structuredClone(englishWeaknesses);
    change(c);
    expect(() => validateWeaknessCatalog(c, englishCatalog)).toThrow();
  };
  invalid((c) => c.definitions.push(c.definitions[0]));
  invalid((c) => c.mappings.push(c.mappings[0]));
  invalid((c) => {
    c.definitions[0].languageCode = 'xx';
  });
  invalid((c) => {
    c.definitions[0].skill = 'diagnosis' as 'grammar';
  });
  invalid((c) => {
    c.mappings[0].activityId = 'unknown';
  });
  invalid((c) => {
    c.mappings[0].weaknessId = 'unknown';
  });
  const study = englishCatalog.course.levels
    .flatMap((l) =>
      l.units.flatMap((u) => u.lessons.flatMap((l) => l.activities)),
    )
    .find((a) => a.type === 'explanation')!;
  invalid((c) => {
    c.mappings[0].activityId = study.id;
  });
  invalid((c) => {
    c.mappings[0].contentVersion = 1;
  });
});
it('records only graded wrong attempts; replay, retries and multiple explicit targets are safe', async () => {
  await startLesson(db, userId, lessonId);
  await advanceLesson(db, userId, lessonId, 0, 2);
  const { weaknessId: _w, ...payload } = request();
  void _w;
  const first = await submitExercise(db, userId, 'en', {
    ...payload,
    lessonId,
  });
  expect((await listWeaknesses(db, userId, 'en'))[0].recurrence).toBe(1);
  expect(
    (await submitExercise(db, userId, 'en', { ...payload, lessonId }))
      .attemptId,
  ).toBe(first.attemptId);
  await submitExercise(db, userId, 'en', {
    ...payload,
    lessonId,
    submissionId: randomUUID(),
    answer: { type: 'multiple_choice', optionId: 'sent' },
  });
  expect((await listWeaknesses(db, userId, 'en'))[0].recurrence).toBe(1);
  await submitExercise(db, userId, 'en', {
    ...payload,
    lessonId,
    submissionId: randomUUID(),
  });
  expect((await listWeaknesses(db, userId, 'en'))[0].status).toBe('repeated');
  await local.insert(schema.activityWeaknesses).values({
    activityId,
    contentVersion: 2,
    weaknessId: 'en-narrative-sequence',
  });
  await submitExercise(db, userId, 'en', {
    ...payload,
    lessonId,
    submissionId: randomUUID(),
  });
  expect(await listWeaknesses(db, userId, 'en')).toHaveLength(2);
  await local
    .delete(schema.activityWeaknesses)
    .where(eq(schema.activityWeaknesses.weaknessId, 'en-narrative-sequence'));
  await seedEnglishWeaknesses(db);
});
it('backfills persisted incorrect history with source dates, ignores correct and unmapped versions, and repeats safely', async () => {
  const wrong = await historical();
  await historical(true);
  await local.insert(schema.exerciseAttempts).values({
    ...wrong,
    id: randomUUID(),
    submissionId: randomUUID(),
    contentVersion: 1,
  });
  await backfillMistakes(db);
  const rows = await local
    .select()
    .from(schema.mistakeOccurrences)
    .where(eq(schema.mistakeOccurrences.userId, userId));
  expect(rows).toHaveLength(1);
  expect(rows[0].createdAt).toEqual(at(1));
  expect(rows[0].attemptId).toBe(wrong.id);
  expect(await backfillMistakes(db)).toEqual({ created: 0 });
  expect(
    await local
      .select()
      .from(schema.exerciseAttempts)
      .where(eq(schema.exerciseAttempts.userId, userId)),
  ).toHaveLength(3);
});
it('aggregates fixed evidence, preserves recurrence after recovery and reactivates on a later error', async () => {
  await historical(false, at(1));
  await historical(false, at(2));
  await backfillMistakes(db);
  const first = (await listWeaknesses(db, userId, 'en'))[0];
  expect(first).toMatchObject({
    recurrence: 2,
    status: 'repeated',
    firstSeen: at(1),
    lastSeen: at(2),
  });
  const bad = request();
  const result = await submitMistakePractice(db, userId, 'en', bad, at(3));
  expect(result.isCorrect).toBe(false);
  const concurrent = await Promise.all([
    submitMistakePractice(db, userId, 'en', bad, at(4)),
    submitMistakePractice(db, userId, 'en', bad, at(4)),
  ]);
  expect(concurrent.map((r) => r.attemptId)).toEqual([
    result.attemptId,
    result.attemptId,
  ]);
  await submitMistakePractice(db, userId, 'en', request('sent'), at(4));
  expect((await listWeaknesses(db, userId, 'en'))[0]).toMatchObject({
    recurrence: 3,
    practiceCount: 2,
    status: 'recovered',
  });
  await historical(false, at(5));
  await backfillMistakes(db);
  expect((await listWeaknesses(db, userId, 'en'))[0]).toMatchObject({
    recurrence: 4,
    status: 'repeated',
  });
  const recent = await recentMistakes(db, userId, 'en');
  expect(recent.map((r) => new Date(r.created_at))).toEqual([
    at(5),
    at(3),
    at(2),
    at(1),
  ]);
  expect(attentionState(1, at(4), at(4))).toBe('needs practice');
});
it('enforces ownership, language, strict input, current mapping/version and the hidden answer boundary', async () => {
  await historical();
  await backfillMistakes(db);
  expect(await listWeaknesses(db, randomUUID(), 'en')).toEqual([]);
  expect(await recentMistakes(db, randomUUID(), 'en')).toEqual([]);
  expect(await listWeaknesses(db, userId, 'ja')).toEqual([]);
  await expect(
    getMistakePractice(db, randomUUID(), 'en', weaknessId),
  ).rejects.toThrow('unavailable');
  await expect(
    submitMistakePractice(db, randomUUID(), 'en', request(), at(2)),
  ).rejects.toThrow('unavailable');
  await expect(
    getMistakePractice(db, userId, 'ja', weaknessId),
  ).rejects.toThrow('unavailable');
  const publicView = JSON.stringify(
    await getMistakePractice(db, userId, 'en', weaknessId),
  );
  for (const hidden of [
    'correctOptionId',
    'acceptedAnswers',
    'explanation',
    'feedback',
  ])
    expect(publicView).not.toContain(hidden);
  for (const forged of [
    { userId },
    { isCorrect: true },
    { recurrence: 1 },
    { status: 'recovered' },
  ])
    await expect(
      submitMistakePractice(
        db,
        userId,
        'en',
        { ...request(), ...forged },
        at(2),
      ),
    ).rejects.toThrow('invalid');
  await expect(
    submitMistakePractice(
      db,
      userId,
      'en',
      { ...request(), activityId: 'en-b1-narrative-typed' },
      at(2),
    ),
  ).rejects.toThrow('stale');
  await expect(
    submitMistakePractice(
      db,
      userId,
      'en',
      { ...request(), weaknessId: 'unknown' },
      at(2),
    ),
  ).rejects.toThrow('unavailable');
  await expect(
    submitMistakePractice(
      db,
      userId,
      'en',
      { ...request(), contentVersion: 1 },
      at(2),
    ),
  ).rejects.toThrow('stale');
  const replay = request();
  await submitMistakePractice(db, userId, 'en', replay, at(2));
  await expect(
    submitMistakePractice(
      db,
      userId,
      'en',
      { ...replay, answer: { type: 'multiple_choice', optionId: 'sent' } },
      at(3),
    ),
  ).rejects.toThrow('invalid');
  await local
    .update(schema.weaknessDefinitions)
    .set({ isPublished: false })
    .where(eq(schema.weaknessDefinitions.id, weaknessId));
  await expect(
    getMistakePractice(db, userId, 'en', weaknessId),
  ).rejects.toThrow('unavailable');
  await seedEnglishWeaknesses(db);
  await local
    .update(schema.activityWeaknesses)
    .set({ isPublished: false })
    .where(eq(schema.activityWeaknesses.weaknessId, weaknessId));
  await expect(
    getMistakePractice(db, userId, 'en', weaknessId),
  ).rejects.toThrow('unavailable');
  await seedEnglishWeaknesses(db);
});
it('preserves all other learner state and denies immutable history updates and forged sources', async () => {
  const a = await historical();
  await backfillMistakes(db);
  const tables = [
    'exercise_attempts',
    'lesson_progress',
    'user_vocabulary',
    'vocabulary_evidence',
    'review_cards',
    'review_sessions',
    'review_session_items',
    'review_history',
  ];
  const snapshot = async () =>
    Promise.all(
      tables.map(
        async (t) =>
          (
            await client.query(
              `select to_jsonb(t) as row from ${t} t order by to_jsonb(t)::text`,
            )
          ).rows,
      ),
    );
  const before = await snapshot();
  await submitMistakePractice(db, userId, 'en', request(), at(2));
  await submitMistakePractice(db, userId, 'en', request('sent'), at(3));
  expect(await snapshot()).toEqual(before);
  await expect(
    local
      .update(schema.mistakeOccurrences)
      .set({ createdAt: at(4) })
      .where(eq(schema.mistakeOccurrences.userId, userId)),
  ).rejects.toThrow();
  await expect(
    local
      .update(schema.mistakePracticeAttempts)
      .set({ isCorrect: true })
      .where(eq(schema.mistakePracticeAttempts.userId, userId)),
  ).rejects.toThrow();
  const correct = await historical(true);
  await expect(
    local.insert(schema.mistakeOccurrences).values({
      userId,
      weaknessId,
      attemptId: correct.id,
      createdAt: correct.createdAt,
    }),
  ).rejects.toThrow();
  await expect(
    local
      .insert(schema.mistakeOccurrences)
      .values({ userId, weaknessId, attemptId: a.id, createdAt: at(9) }),
  ).rejects.toThrow();
  await local.delete(schema.users).where(eq(schema.users.id, userId));
  expect(
    await local
      .select()
      .from(schema.mistakeOccurrences)
      .where(eq(schema.mistakeOccurrences.userId, userId)),
  ).toHaveLength(0);
  expect(
    await local
      .select()
      .from(schema.mistakePracticeAttempts)
      .where(eq(schema.mistakePracticeAttempts.userId, userId)),
  ).toHaveLength(0);
});
it('preserves honest matching partial scores at concept level', async () => {
  const [a] = await local
    .insert(schema.exerciseAttempts)
    .values({
      userId,
      lessonId: 'en-b1-collocations',
      activityId: 'en-b1-collocations-match',
      contentVersion: 2,
      submissionId: randomUUID(),
      submittedAnswer: {
        type: 'matching',
        pairs: [
          { leftId: 'make', rightId: 'decision' },
          { leftId: 'take', rightId: 'promise' },
          { leftId: 'keep', rightId: 'break' },
        ],
      },
      result: {
        isCorrect: false,
        score: 1 / 3,
        expectedAnswer: 'Saved pairs',
        explanation: 'Natural collocations',
        feedback: '1 of 3 pairs matched.',
      },
      isCorrect: false,
      score: 1 / 3,
      createdAt: at(1),
    })
    .returning();
  await recordMistakes(db, a.id);
  const recent = await recentMistakes(db, userId, 'en');
  expect(recent).toHaveLength(1);
  expect(recent[0].result.score).toBeCloseTo(1 / 3);
  const result = await submitMistakePractice(
    db,
    userId,
    'en',
    {
      submissionId: randomUUID(),
      weaknessId: 'en-verb-noun-collocations',
      activityId: a.activityId,
      contentVersion: 2,
      answer: a.submittedAnswer,
    },
    at(2),
  );
  expect(result.score).toBeCloseTo(1 / 3);
  expect(result.feedback).toBe('1 of 3 pairs matched.');
});

it('rejects technical failures without recording learning mistakes', async () => {
  const { weaknessId: _w, ...payload } = request();
  void _w;
  await expect(
    submitExercise(db, userId, 'en', { ...payload, lessonId }),
  ).rejects.toThrow();
  await startLesson(db, userId, lessonId);
  await advanceLesson(db, userId, lessonId, 0, 2);
  for (const invalid of [
    { ...payload, lessonId, contentVersion: 99 },
    { ...payload, lessonId, userId },
    {
      ...payload,
      lessonId,
      answer: { type: 'multiple_choice', optionId: 'unknown' },
    },
    {
      ...payload,
      lessonId: 'en-b1-narrative',
      activityId: 'en-b1-narrative-typed',
    },
  ])
    await expect(submitExercise(db, userId, 'en', invalid)).rejects.toThrow();
  expect(await listWeaknesses(db, userId, 'en')).toEqual([]);
  expect(
    await local
      .select()
      .from(schema.exerciseAttempts)
      .where(eq(schema.exerciseAttempts.userId, userId)),
  ).toHaveLength(0);
});

it('fails safe on removal of editorial identities and survives a curriculum version change', async () => {
  await historical();
  await backfillMistakes(db);
  await local
    .update(schema.lessons)
    .set({ contentVersion: 3 })
    .where(eq(schema.lessons.id, lessonId));
  await expect(
    getMistakePractice(db, userId, 'en', weaknessId),
  ).rejects.toThrow('unavailable');
  expect((await recentMistakes(db, userId, 'en'))[0]).toMatchObject({
    content_version: 2,
    current_version: 3,
  });
  await seedEnglishCourse(db);
  await local.insert(schema.weaknessDefinitions).values({
    id: 'en-retained-history',
    languageCode: 'en',
    label: 'Retained identity',
    description: 'A synthetic retired editorial identity.',
    skill: 'grammar',
    isPublished: false,
  });
  await expect(seedEnglishWeaknesses(db)).rejects.toThrow('explicit migration');
  await local
    .delete(schema.weaknessDefinitions)
    .where(eq(schema.weaknessDefinitions.id, 'en-retained-history'));
  await seedEnglishWeaknesses(db);
});

it('retires removed mappings during seed while retaining their historical classification', async () => {
  await local.insert(schema.activityWeaknesses).values({
    activityId,
    weaknessId: 'en-narrative-sequence',
    contentVersion: 1,
  });
  await seedEnglishWeaknesses(db);
  const rows = await local
    .select()
    .from(schema.activityWeaknesses)
    .where(eq(schema.activityWeaknesses.activityId, activityId));
  expect(rows.find((m) => m.contentVersion === 1)).toMatchObject({
    isPublished: false,
  });
  expect(rows.find((m) => m.contentVersion === 2)).toMatchObject({
    isPublished: true,
  });
});
