import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import {
  englishVocabulary,
  vocabularyCatalogSchema,
} from '../src/content/en/vocabulary';
import { seedEnglishCourse } from '../src/server/course/seed';
import { seedEnglishVocabulary } from '../src/server/vocabulary/seed';
import {
  listVocabulary,
  getVocabularyDetail,
  learningStatus,
  setSavedVocabulary,
} from '../src/server/vocabulary/repository';
import { startLesson, advanceLesson } from '../src/server/course/repository';
import { submitExercise } from '../src/server/exercises/repository';

const client = new PGlite();
const local = drizzle(client, { schema });
const db = local as unknown as ReturnType<typeof getDb>;
let userId: string;
let otherId: string;
const lessonId = 'en-b1-collocations';
const choice = (
  submissionId: string,
  pairs: { leftId: string; rightId: string }[],
) => ({
  submissionId,
  lessonId,
  activityId: 'en-b1-collocations-match',
  contentVersion: 2,
  answer: { type: 'matching', pairs },
});
const correctPairs = [
  { leftId: 'make', rightId: 'decision' },
  { leftId: 'take', rightId: 'break' },
  { leftId: 'keep', rightId: 'promise' },
];

beforeAll(async () => {
  await migrate(local, { migrationsFolder: 'drizzle' });
  await local.insert(schema.languages).values({ code: 'ro', name: 'Romanian' });
  await seedEnglishCourse(db);
  await seedEnglishVocabulary(db);
  [userId, otherId] = (
    await local
      .insert(schema.users)
      .values([
        { email: `${randomUUID()}@example.test` },
        { email: `${randomUUID()}@example.test` },
      ])
      .returning()
  ).map((row) => row.id);
  for (const id of [userId, otherId]) {
    await local.insert(schema.lessonProgress).values([
      {
        userId: id,
        lessonId: 'en-b1-present-perfect',
        contentVersion: 2,
        status: 'completed',
        position: 5,
        completedAt: new Date(),
      },
      {
        userId: id,
        lessonId: 'en-b1-narrative',
        contentVersion: 2,
        status: 'completed',
        position: 4,
        completedAt: new Date(),
      },
    ]);
  }
}, 30000);
afterAll(async () => client.close());

it('validates stable senses and explicit references', () => {
  expect(englishVocabulary.senses).toHaveLength(16);
  expect(
    vocabularyCatalogSchema.safeParse({
      ...englishVocabulary,
      senses: [...englishVocabulary.senses, englishVocabulary.senses[0]],
    }).success,
  ).toBe(false);
  expect(
    vocabularyCatalogSchema.safeParse({
      ...englishVocabulary,
      senses: [
        { ...englishVocabulary.senses[0], level: 'Z9' },
        ...englishVocabulary.senses.slice(1),
      ],
    }).success,
  ).toBe(false);
  expect(
    vocabularyCatalogSchema.safeParse({
      ...englishVocabulary,
      senses: [
        { ...englishVocabulary.senses[0], partOfSpeech: 'unknown' },
        ...englishVocabulary.senses.slice(1),
      ],
    }).success,
  ).toBe(false);
  expect(
    vocabularyCatalogSchema.safeParse({
      ...englishVocabulary,
      families: [['en-decision-noun-1', 'en-decision-noun-1']],
    }).success,
  ).toBe(false);
  expect(
    vocabularyCatalogSchema.safeParse({
      ...englishVocabulary,
      associations: [
        {
          activityId: 'unknown',
          senseId: 'en-decision-noun-1',
          role: 'introduces',
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    vocabularyCatalogSchema.safeParse({
      ...englishVocabulary,
      collocations: [
        {
          id: 'broken',
          phrase: 'bad phrase',
          example: 'This example sentence is longer.',
          senseIds: ['unknown'],
        },
      ],
    }).success,
  ).toBe(false);
});
it('derives cautious learning stages from real counts', () => {
  expect(learningStatus(false, 0, 0)).toBe('not encountered');
  expect(learningStatus(true, 0, 0)).toBe('encountered');
  expect(learningStatus(true, 1, 0)).toBe('practising');
  expect(learningStatus(true, 2, 0)).toBe('familiar');
  expect(learningStatus(true, 4, 0)).toBe('strong');
  expect(learningStatus(true, 4, 1)).toBe('practising');
});
it('keeps saved words separate and user-specific, and rejects unknown IDs', async () => {
  expect(
    await setSavedVocabulary(db, userId, 'en', 'en-decision-noun-1', true),
  ).toBe(true);
  expect(
    await setSavedVocabulary(db, userId, 'en', 'en-decision-noun-1', true),
  ).toBe(true);
  expect(
    (await listVocabulary(db, userId, 'en')).find(
      (item) => item.id === 'en-decision-noun-1',
    ),
  ).toMatchObject({
    saved: true,
    introduced: false,
    status: 'not encountered',
  });
  expect(
    (await listVocabulary(db, otherId, 'en')).find(
      (item) => item.id === 'en-decision-noun-1',
    )?.saved,
  ).toBe(false);
  expect(await setSavedVocabulary(db, userId, 'en', 'unknown', true)).toBe(
    false,
  );
  expect(
    await setSavedVocabulary(db, userId, 'ja', 'en-decision-noun-1', true),
  ).toBe(false);
  expect(
    await setSavedVocabulary(db, userId, 'en', 'en-decision-noun-1', false),
  ).toBe(true);
  expect(
    (await getVocabularyDetail(db, userId, 'en', 'en-decision-noun-1'))
      ?.collocations,
  ).toHaveLength(1);
  expect(
    (await getVocabularyDetail(db, userId, 'en', 'en-decision-noun-1'))?.family,
  ).toHaveLength(2);
});
it('does not invent practice evidence for grammar-only exercises', async () => {
  const [grammarUser] = await local
    .insert(schema.users)
    .values({ email: `${randomUUID()}@example.test` })
    .returning();
  await startLesson(db, grammarUser.id, 'en-b1-present-perfect');
  await advanceLesson(db, grammarUser.id, 'en-b1-present-perfect', 0, 2);
  await submitExercise(db, grammarUser.id, 'en', {
    submissionId: randomUUID(),
    lessonId: 'en-b1-present-perfect',
    activityId: 'en-b1-present-perfect-choice',
    contentVersion: 2,
    answer: { type: 'multiple_choice', optionId: 'sent' },
  });
  expect(
    await local
      .select()
      .from(schema.vocabularyEvidence)
      .where(eq(schema.vocabularyEvidence.userId, grammarUser.id)),
  ).toHaveLength(0);
  expect(
    (await listVocabulary(db, grammarUser.id, 'en')).filter(
      (item) => item.introduced,
    ),
  ).toHaveLength(0);
});
it('introduces only on traversal; grades targeted pairs, retries and replay once', async () => {
  await startLesson(db, userId, lessonId);
  let words = await listVocabulary(db, userId, 'en');
  expect(words.find((item) => item.id === 'en-break-noun-1')?.introduced).toBe(
    false,
  );
  expect((await advanceLesson(db, userId, lessonId, 0, 2)).position).toBe(1);
  await expect(advanceLesson(db, userId, lessonId, 0, 2)).rejects.toMatchObject(
    { code: 'stale' },
  );
  words = await listVocabulary(db, userId, 'en');
  expect(words.filter((item) => item.introduced)).toHaveLength(3);
  expect(
    (await listVocabulary(db, otherId, 'en')).filter((item) => item.introduced),
  ).toHaveLength(0);
  const wrong = choice(randomUUID(), [
    { leftId: 'make', rightId: 'decision' },
    { leftId: 'take', rightId: 'promise' },
    { leftId: 'keep', rightId: 'break' },
  ]);
  const first = await submitExercise(db, userId, 'en', wrong);
  expect(first.score).toBeCloseTo(1 / 3);
  const replay = await submitExercise(db, userId, 'en', wrong);
  expect(replay.attemptId).toBe(first.attemptId);
  const second = await submitExercise(
    db,
    userId,
    'en',
    choice(randomUUID(), correctPairs),
  );
  expect(second.isCorrect).toBe(true);
  const evidence = await local
    .select()
    .from(schema.vocabularyEvidence)
    .where(eq(schema.vocabularyEvidence.userId, userId));
  expect(evidence).toHaveLength(6);
  expect(evidence.filter((row) => row.isCorrect)).toHaveLength(4);
  await expect(
    local
      .update(schema.vocabularyEvidence)
      .set({ isCorrect: false })
      .where(eq(schema.vocabularyEvidence.attemptId, first.attemptId)),
  ).rejects.toThrow();
  expect(
    (await listVocabulary(db, userId, 'en')).find(
      (item) => item.id === 'en-break-noun-1',
    ),
  ).toMatchObject({ correct: 1, incorrect: 1, status: 'practising' });
  expect(
    (await listVocabulary(db, otherId, 'en')).find(
      (item) => item.id === 'en-break-noun-1',
    ),
  ).toMatchObject({ correct: 0, incorrect: 0, status: 'not encountered' });
  await seedEnglishVocabulary(db);
  await seedEnglishVocabulary(db);
  expect(
    await local
      .select()
      .from(schema.vocabularyEvidence)
      .where(eq(schema.vocabularyEvidence.userId, userId)),
  ).toHaveLength(6);
  expect(
    await local
      .select()
      .from(schema.userVocabulary)
      .where(eq(schema.userVocabulary.userId, userId)),
  ).toHaveLength(3);
});
