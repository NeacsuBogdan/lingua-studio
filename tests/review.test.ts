import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { and, eq } from 'drizzle-orm';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import { seedEnglishCourse } from '../src/server/course/seed';
import { seedEnglishVocabulary } from '../src/server/vocabulary/seed';
import { setSavedVocabulary } from '../src/server/vocabulary/repository';
import { advanceLesson, startLesson } from '../src/server/course/repository';
import { submitExercise } from '../src/server/exercises/repository';
import {
  emptyCard,
  fromRow,
  schedule,
  toColumns,
  SCHEDULER_VERSION,
} from '../src/server/review/scheduler';
import {
  backfillEligibleCards,
  ensureReviewCard,
  finishReviewSession,
  getDueCount,
  getReviewAnswer,
  getReviewOverview,
  getReviewSession,
  skipStaleReviewItem,
  startReviewSession,
  submitReview,
} from '../src/server/review/repository';

const client = new PGlite();
const local = drizzle(client, { schema });
const db = local as unknown as ReturnType<typeof getDb>;
const now = new Date('2030-01-02T12:00:00.000Z');
let owner: string;
let other: string;

beforeAll(async () => {
  await migrate(local, { migrationsFolder: 'drizzle' });
  await local.insert(schema.languages).values({ code: 'ro', name: 'Romanian' });
  await seedEnglishCourse(db);
  await seedEnglishVocabulary(db);
  const rows = await local
    .insert(schema.users)
    .values([
      { email: `${randomUUID()}@example.test` },
      { email: `${randomUUID()}@example.test` },
    ])
    .returning({ id: schema.users.id });
  owner = rows[0].id;
  other = rows[1].id;
  await local.insert(schema.learnerProfiles).values([
    { userId: owner, nativeLanguage: 'ro', learningLanguage: 'en' },
    { userId: other, nativeLanguage: 'ro', learningLanguage: 'en' },
  ]);
}, 30000);
afterAll(async () => client.close());

it('uses official FSRS state, distinguishes ratings and reconstructs precisely', () => {
  const initial = emptyCard(now);
  expect(initial.state).toBe(0);
  const outcomes = ['Again', 'Hard', 'Good', 'Easy'] as const;
  const scheduled = outcomes.map(
    (rating) => schedule(initial, rating, now).card,
  );
  expect(scheduled.map((card) => card.due.getTime())).toEqual(
    [...scheduled.map((card) => card.due.getTime())].sort((a, b) => a - b),
  );
  expect(new Set(scheduled.map((card) => card.due.getTime())).size).toBe(4);
  const good = scheduled[2];
  const reconstructed = fromRow({
    ...toColumns(good),
    id: randomUUID(),
    userId: owner,
    senseId: 'en-decision-noun-1',
    kind: 'recognition',
    revision: 1,
    schedulerVersion: SCHEDULER_VERSION,
    createdAt: now,
    updatedAt: now,
  });
  expect(reconstructed).toEqual(good);
  const later = new Date(good.due.getTime() + 1000);
  const next = schedule(good, 'Good', later).card;
  expect(next.reps).toBe(good.reps + 1);
  const lapse = schedule(
    next,
    'Again',
    new Date(next.due.getTime() + 1000),
  ).card;
  expect(lapse.lapses).toBeGreaterThanOrEqual(next.lapses);
});

it('keeps bookmarks ineligible and backfills introduced state without invented reviews', async () => {
  const savedOnly = 'en-decision-noun-1';
  await setSavedVocabulary(db, owner, 'en', savedOnly, true);
  expect(await backfillEligibleCards(db, now)).toEqual({
    eligible: 0,
    created: 0,
  });
  expect(await local.select().from(schema.reviewCards)).toHaveLength(0);
  await local
    .insert(schema.userVocabulary)
    .values({ userId: owner, senseId: 'en-decide-verb-1', introducedAt: now });
  expect(await backfillEligibleCards(db, now)).toEqual({
    eligible: 1,
    created: 1,
  });
  expect(await backfillEligibleCards(db, now)).toEqual({
    eligible: 1,
    created: 0,
  });
  expect(await local.select().from(schema.reviewHistory)).toHaveLength(0);
  expect(
    await local
      .select()
      .from(schema.reviewCards)
      .where(eq(schema.reviewCards.senseId, savedOnly)),
  ).toHaveLength(0);
  expect(
    await local
      .select()
      .from(schema.reviewCards)
      .where(eq(schema.reviewCards.userId, other)),
  ).toHaveLength(0);
});

it('creates cards on trusted introduction and does not duplicate them', async () => {
  await local.insert(schema.lessonProgress).values([
    {
      userId: other,
      lessonId: 'en-b1-present-perfect',
      contentVersion: 2,
      status: 'completed',
      position: 5,
      completedAt: now,
    },
    {
      userId: other,
      lessonId: 'en-b1-narrative',
      contentVersion: 2,
      status: 'completed',
      position: 4,
      completedAt: now,
    },
  ]);
  await startLesson(db, other, 'en-b1-collocations');
  await advanceLesson(db, other, 'en-b1-collocations', 0, 2);
  const cards = await local
    .select()
    .from(schema.reviewCards)
    .where(eq(schema.reviewCards.userId, other));
  expect(cards).toHaveLength(3);
  expect(cards.every((card) => card.state === 0 && card.reps === 0)).toBe(true);
  expect((await backfillEligibleCards(db, now)).created).toBe(0);
});

it('limits sessions, enforces ownership and records one immutable schedule on replay', async () => {
  const futureId = 'en-decision-noun-1';
  await ensureReviewCard(
    db,
    owner,
    futureId,
    new Date(now.getTime() + 86400000),
  );
  expect(await getDueCount(db, owner, 'en', now)).toBe(1);
  expect(await getDueCount(db, owner, 'ja', now)).toBe(0);
  const sessionId = await startReviewSession(db, owner, 'en', now);
  expect(sessionId).toBeTruthy();
  expect(await startReviewSession(db, owner, 'en', now)).toBe(sessionId);
  const view = await getReviewSession(db, owner, 'en', sessionId!, now);
  expect(view.size).toBe(1);
  await expect(
    getReviewSession(db, owner, 'ja', sessionId!, now),
  ).rejects.toMatchObject({ code: 'not_found' });
  expect(view.current?.position).toBe(1);
  await expect(
    getReviewSession(db, other, 'en', sessionId!, now),
  ).rejects.toMatchObject({ code: 'not_found' });
  await expect(
    getReviewAnswer(db, other, 'en', sessionId!, view.current!.itemId, now),
  ).rejects.toMatchObject({ code: 'not_found' });
  expect(
    (
      await getReviewAnswer(
        db,
        owner,
        'en',
        sessionId!,
        view.current!.itemId,
        now,
      )
    ).definition,
  ).toBeTruthy();
  const request = {
    sessionId: sessionId!,
    itemId: view.current!.itemId,
    cardId: view.current!.cardId,
    submissionId: randomUUID(),
    rating: 'Good' as const,
  };
  await expect(
    submitReview(db, other, 'en', request, now),
  ).rejects.toMatchObject({ code: 'not_found' });
  const first = await submitReview(db, owner, 'en', request, now);
  const replay = await submitReview(db, owner, 'en', request, now);
  expect(first.replay).toBe(false);
  expect(replay).toEqual({ ...first, replay: true });
  await expect(
    submitReview(db, owner, 'en', { ...request, rating: 'Easy' }, now),
  ).rejects.toMatchObject({ code: 'invalid' });
  await expect(
    submitReview(
      db,
      owner,
      'en',
      { ...request, submissionId: randomUUID() },
      now,
    ),
  ).rejects.toMatchObject({ code: 'stale' });
  const [card] = await local
    .select()
    .from(schema.reviewCards)
    .where(eq(schema.reviewCards.id, request.cardId));
  expect(card.revision).toBe(1);
  expect(card.reps).toBe(1);
  const history = await local
    .select()
    .from(schema.reviewHistory)
    .where(eq(schema.reviewHistory.cardId, request.cardId));
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({
    rating: 3,
    beforeState: 0,
    schedulerVersion: SCHEDULER_VERSION,
  });
  await expect(
    local
      .update(schema.reviewHistory)
      .set({ rating: 4 })
      .where(eq(schema.reviewHistory.id, history[0].id)),
  ).rejects.toThrow();
  expect(
    (await getReviewSession(db, owner, 'en', sessionId!, now)).current,
  ).toBeNull();
  await finishReviewSession(db, owner, sessionId!, now);
  await finishReviewSession(db, owner, sessionId!, now);
  expect(
    (await getReviewSession(db, owner, 'en', sessionId!, now)).status,
  ).toBe('completed');
  const stats = await getReviewOverview(db, owner, 'en', now);
  expect(stats.ratings.Good).toBe(1);
  expect(stats.recentCount).toBe(1);
  expect(stats.nextDue).toBeTruthy();
});

it('trusts graded practice even without a historical introduction, but never fabricates a rating', async () => {
  await local.insert(schema.lessonProgress).values([
    {
      userId: owner,
      lessonId: 'en-b1-present-perfect',
      contentVersion: 2,
      status: 'completed',
      position: 5,
      completedAt: now,
    },
    {
      userId: owner,
      lessonId: 'en-b1-narrative',
      contentVersion: 2,
      status: 'completed',
      position: 4,
      completedAt: now,
    },
    {
      userId: owner,
      lessonId: 'en-b1-collocations',
      contentVersion: 2,
      status: 'in_progress',
      position: 1,
    },
  ]);
  await submitExercise(db, owner, 'en', {
    submissionId: randomUUID(),
    lessonId: 'en-b1-collocations',
    activityId: 'en-b1-collocations-match',
    contentVersion: 2,
    answer: {
      type: 'matching',
      pairs: [
        { leftId: 'make', rightId: 'decision' },
        { leftId: 'take', rightId: 'break' },
        { leftId: 'keep', rightId: 'promise' },
      ],
    },
  });
  const [decision] = await local
    .select()
    .from(schema.reviewCards)
    .where(
      and(
        eq(schema.reviewCards.userId, owner),
        eq(schema.reviewCards.senseId, 'en-decision-noun-1'),
      ),
    );
  expect(decision).toMatchObject({ state: 0, reps: 0, revision: 0 });
  const [vocab] = await local
    .select()
    .from(schema.userVocabulary)
    .where(
      and(
        eq(schema.userVocabulary.userId, owner),
        eq(schema.userVocabulary.senseId, 'en-decision-noun-1'),
      ),
    );
  expect(vocab.introducedAt).toBeNull();
  expect((await backfillEligibleCards(db, now)).created).toBe(0);
  expect(
    await local
      .select()
      .from(schema.reviewHistory)
      .where(eq(schema.reviewHistory.senseId, 'en-decision-noun-1')),
  ).toHaveLength(0);
});

it('caps due selection at twenty and keeps future cards out', async () => {
  const fakeSenses = Array.from({ length: 18 }, (_, i) => ({
    id: `en-review-test-${i}`,
    languageCode: 'en',
    lemma: `review${i}`,
    displayForm: `Review ${i}`,
    partOfSpeech: 'noun',
    level: 'B1' as const,
    definition: 'A temporary sense for bounded review session testing.',
  }));
  await local.insert(schema.vocabularySenses).values(fakeSenses);
  for (const sense of fakeSenses)
    await ensureReviewCard(db, other, sense.id, now);
  const sessionId = await startReviewSession(db, other, 'en', now);
  expect(sessionId).toBeTruthy();
  expect((await getReviewSession(db, other, 'en', sessionId!, now)).size).toBe(
    20,
  );
  const first = (await getReviewSession(db, other, 'en', sessionId!, now))
    .current!;
  await local
    .update(schema.reviewCards)
    .set({ due: new Date(now.getTime() + 86400000) })
    .where(eq(schema.reviewCards.id, first.cardId));
  await expect(
    submitReview(
      db,
      other,
      'en',
      {
        sessionId: sessionId!,
        itemId: first.itemId,
        cardId: first.cardId,
        submissionId: randomUUID(),
        rating: 'Good',
      },
      now,
    ),
  ).rejects.toMatchObject({ code: 'not_due' });
  await skipStaleReviewItem(db, other, 'en', sessionId!, first.itemId, now);
  expect(
    (await getReviewSession(db, other, 'en', sessionId!, now)).current
      ?.position,
  ).toBe(2);
});
