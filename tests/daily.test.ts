import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
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
  advanceLesson,
  getLessonView,
  startLesson,
} from '../src/server/course/repository';
import { submitExercise } from '../src/server/exercises/repository';
import {
  submitMistakePractice,
  listWeaknesses,
} from '../src/server/mistakes/repository';
import {
  ensureReviewCard,
  getReviewSession,
  startReviewSession,
  submitReview,
} from '../src/server/review/repository';
import {
  getTodayDaily,
  getDailySession,
  startDailySession,
} from '../src/server/daily/repository';
import { isExercise } from '../src/content/activity-schema';
import { correctAnswer } from './helpers/exercise';

const client = new PGlite();
const local = drizzle(client, { schema });
const db = local as unknown as ReturnType<typeof getDb>;
const now = new Date('2030-01-02T12:00:00Z');
const later = new Date('2030-01-02T12:01:00Z');
let owner: string;
let other: string;
const practice = (submissionId = randomUUID()) => ({
  weaknessId: 'en-past-present-perfect',
  activityId: 'en-b1-present-perfect-choice',
  contentVersion: 2,
  submissionId,
  answer: { type: 'multiple_choice', optionId: 'have-sent' },
});

beforeAll(async () => {
  await migrate(local, { migrationsFolder: 'drizzle' });
  await local
    .insert(schema.languages)
    .values({ code: 'ro', name: 'Romanian', isActive: false });
  await seedEnglishCourse(db);
  await seedEnglishVocabulary(db);
  await seedEnglishWeaknesses(db);
}, 30000);
beforeEach(async () => {
  const rows = await local
    .insert(schema.users)
    .values([
      { email: `${randomUUID()}@example.test` },
      { email: `${randomUUID()}@example.test` },
    ])
    .returning();
  [owner, other] = rows.map((r) => r.id);
  await local.insert(schema.learnerProfiles).values(
    [owner, other].map((userId) => ({
      userId,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
      dailyMinutes: 5,
    })),
  );
});
afterEach(async () => {
  await local.delete(schema.users).where(eq(schema.users.id, owner));
  await local.delete(schema.users).where(eq(schema.users.id, other));
});
afterAll(() => client.close());

it('keeps the saved timezone when preference changes move the current local day', async () => {
  const instant = new Date('2030-01-02T22:30:00Z');
  const oldId = await startDailySession(db, owner, instant);
  await local
    .update(schema.learnerProfiles)
    .set({ timezone: 'UTC', dailyMinutes: 10 })
    .where(eq(schema.learnerProfiles.userId, owner));
  const nextId = await startDailySession(db, owner, instant);
  expect(nextId).not.toBe(oldId);
  const old = await getDailySession(db, owner, 'en', oldId, instant);
  const next = await getDailySession(db, owner, 'en', nextId, instant);
  expect(old.session).toMatchObject({
    studyDate: '2030-01-03',
    timezone: 'Europe/Bucharest',
    targetMinutes: 5,
  });
  expect(next.session).toMatchObject({
    studyDate: '2030-01-02',
    timezone: 'UTC',
    targetMinutes: 10,
  });
  await local
    .update(schema.learnerProfiles)
    .set({ timezone: 'Europe/Bucharest' })
    .where(eq(schema.learnerProfiles.userId, owner));
  expect(await startDailySession(db, owner, instant)).toBe(oldId);
});

it('never starts a competing Review session when another language has an active session', async () => {
  await ensureReviewCard(db, owner, 'en-decision-noun-1', now);
  await local
    .insert(schema.reviewSessions)
    .values({ userId: owner, languageCode: 'ro', createdAt: now });
  const today = await getTodayDaily(db, owner, now);
  expect(today.preview!.some((i) => i.kind === 'review')).toBe(false);
  const id = await startDailySession(db, owner, now);
  expect((await plan(id)).items.some((i) => i.kind === 'review')).toBe(false);
  expect(await local.select().from(schema.reviewSessions)).toHaveLength(1);
});

it('resolves a wholly unavailable plan once without crediting completed work or reopening it', async () => {
  const id = await startDailySession(db, owner, now);
  try {
    await local
      .update(schema.lessons)
      .set({ contentVersion: 3 })
      .where(eq(schema.lessons.id, 'en-b1-present-perfect'));
    const resolved = await plan(id);
    expect(resolved.session.completedAt).toEqual(later);
    expect(resolved.items[0]).toMatchObject({
      status: 'unavailable',
      completedUnits: 0,
      completedAt: null,
    });
    await local
      .update(schema.lessons)
      .set({ contentVersion: 2 })
      .where(eq(schema.lessons.id, 'en-b1-present-perfect'));
    expect(await plan(id)).toEqual(resolved);
  } finally {
    await local
      .update(schema.lessons)
      .set({ contentVersion: 2 })
      .where(eq(schema.lessons.id, 'en-b1-present-perfect'));
  }
});

async function mixedFixture() {
  await startLesson(db, owner, 'en-b1-present-perfect');
  await advanceLesson(db, owner, 'en-b1-present-perfect', 0, 2);
  for (let i = 0; i < 2; i++)
    await submitExercise(db, owner, 'en', {
      lessonId: 'en-b1-present-perfect',
      activityId: 'en-b1-present-perfect-choice',
      contentVersion: 2,
      submissionId: randomUUID(),
      answer: { type: 'multiple_choice', optionId: 'have-sent' },
    });
  const senses = await local.select().from(schema.vocabularySenses).limit(8);
  for (const sense of senses)
    await ensureReviewCard(db, owner, sense.id, new Date(now.getTime() - 1000));
}
async function plan(id: string, time = later) {
  return getDailySession(db, owner, 'en', id, time);
}
async function rate(
  sessionId: string,
  rating: 'Again' | 'Hard' | 'Good' | 'Easy',
  time = later,
) {
  const view = await getReviewSession(db, owner, 'en', sessionId, time);
  const payload = {
    sessionId,
    itemId: view.current!.itemId,
    cardId: view.current!.cardId,
    submissionId: randomUUID(),
    rating,
  };
  await submitReview(db, owner, 'en', payload, time);
  return payload;
}

it('preview writes nothing; Start persists one stable bounded mixed plan', async () => {
  await mixedFixture();
  const preview = await getTodayDaily(db, owner, now);
  expect(preview.plan).toBeNull();
  expect(preview.preview!.map((i) => i.kind)).toEqual([
    'review',
    'mistake',
    'lesson',
  ]);
  expect(await local.select().from(schema.dailySessions)).toHaveLength(0);
  const id = await startDailySession(db, owner, now);
  const saved = await plan(id);
  expect(saved.session).toMatchObject({
    targetMinutes: 5,
    timezone: 'Europe/Bucharest',
    studyDate: '2030-01-02',
    plannerVersion: 'daily-v1',
  });
  expect(saved.session.plannedMinutes).toBeLessThanOrEqual(5);
  await local
    .update(schema.learnerProfiles)
    .set({ dailyMinutes: 60, timezone: 'UTC' })
    .where(eq(schema.learnerProfiles.userId, owner));
  expect(await startDailySession(db, owner, later)).toBe(id);
  expect(await plan(id)).toEqual(saved);
  expect((await getTodayDaily(db, owner, later)).plan!.items).toEqual(
    saved.items,
  );
  await expect(
    getDailySession(db, other, 'en', id, later),
  ).rejects.toMatchObject({ code: 'not_found' });
  await expect(
    getDailySession(db, owner, 'ro', id, later),
  ).rejects.toMatchObject({ code: 'not_found' });
});

it('concurrent duplicate starts return the same identity and ordered targets', async () => {
  const ids = await Promise.all([
    startDailySession(db, owner, now),
    startDailySession(db, owner, now),
    startDailySession(db, owner, now),
  ]);
  expect(new Set(ids).size).toBe(1);
  expect(await local.select().from(schema.dailySessions)).toHaveLength(1);
  expect((await plan(ids[0])).items.map((i) => i.position)).toEqual([1]);
});

it('recomputes Start from trusted state rather than the earlier preview', async () => {
  const preview = await getTodayDaily(db, owner, now);
  expect(preview.profile.dailyMinutes).toBe(5);
  expect(preview.preview!.some((i) => i.kind === 'review')).toBe(false);
  await local
    .update(schema.learnerProfiles)
    .set({ dailyMinutes: 10 })
    .where(eq(schema.learnerProfiles.userId, owner));
  await ensureReviewCard(db, owner, 'en-decision-noun-1', now);
  const id = await startDailySession(db, owner, now);
  const saved = await plan(id);
  expect(saved.session.targetMinutes).toBe(10);
  expect(saved.items.some((i) => i.kind === 'review')).toBe(true);
  expect(saved.session.plannedMinutes).toBeLessThanOrEqual(10);
});

it('counts accepted FSRS ratings, one incorrect corrective attempt and ordinary lesson advancement, with replay safety', async () => {
  await mixedFixture();
  const reviewId = (await startReviewSession(db, owner, 'en', now))!;
  const id = await startDailySession(db, owner, now);
  let daily = await plan(id);
  expect(daily.items.find((i) => i.kind === 'review')!.href).toBe(
    `/review/session/${reviewId}`,
  );
  const reviewTarget = daily.items.find(
    (i) => i.kind === 'review',
  )!.targetCount;
  for (let i = 0; i < reviewTarget; i++) {
    const payload = await rate(
      reviewId,
      (['Again', 'Hard', 'Good', 'Easy'] as const)[i % 4],
    );
    await submitReview(db, owner, 'en', payload, later);
  }
  const request = practice();
  await submitMistakePractice(db, owner, 'en', request, later);
  await submitMistakePractice(db, owner, 'en', request, later);
  daily = await plan(id);
  expect(daily.items.find((i) => i.kind === 'review')!.status).toBe(
    'completed',
  );
  expect(daily.items.find((i) => i.kind === 'mistake')!.status).toBe(
    'completed',
  );
  expect((await listWeaknesses(db, owner, 'en'))[0].status).toBe('repeated');
  expect(
    (await getReviewSession(db, owner, 'en', reviewId, later)).status,
  ).toBe('active');
  const segment = daily.items.find((i) => i.kind === 'lesson')!;
  for (
    let position = segment.startPosition!;
    position < segment.targetPosition!;
    position++
  ) {
    const view = await getLessonView(db, owner, 'en', segment.lessonId!);
    const activity = view.activities[position];
    if (isExercise(activity))
      await submitExercise(db, owner, 'en', {
        lessonId: view.lesson.id,
        activityId: activity.id,
        contentVersion: 2,
        submissionId: randomUUID(),
        answer: correctAnswer(activity),
      });
    await advanceLesson(db, owner, view.lesson.id, position, 2);
  }
  const completed = await plan(id);
  expect(completed.session.completedAt).toEqual(later);
  expect(completed.items.every((i) => i.status === 'completed')).toBe(true);
  await rate(reviewId, 'Good', new Date(later.getTime() + 60000));
  expect(await plan(id, new Date(later.getTime() + 120000))).toEqual(completed);
  expect(await startDailySession(db, owner, later)).toBe(id);
  expect(
    await local.select().from(schema.mistakePracticeAttempts),
  ).toHaveLength(1);
});

it.each(['Again', 'Hard', 'Good', 'Easy'] as const)(
  'accepts %s as Review work without creating mistakes',
  async (rating) => {
    await ensureReviewCard(db, owner, 'en-decision-noun-1', now);
    const id = await startDailySession(db, owner, now);
    const reviewId = (await startReviewSession(db, owner, 'en', now))!;
    await rate(reviewId, rating);
    expect(
      (await plan(id)).items.find((i) => i.kind === 'review')!.completedUnits,
    ).toBe(1);
    expect(await local.select().from(schema.mistakeOccurrences)).toHaveLength(
      0,
    );
  },
);

it('excludes old/tied source events and recovered weaknesses from new plans', async () => {
  await mixedFixture();
  const reviewId = (await startReviewSession(db, owner, 'en', now))!;
  await rate(reviewId, 'Again', now);
  await submitMistakePractice(db, owner, 'en', practice(), now);
  const id = await startDailySession(db, owner, now);
  const daily = await plan(id);
  expect(
    daily.items
      .filter((i) => i.kind !== 'lesson')
      .every((i) => i.completedUnits === 0 && i.baselineCount === 1),
  ).toBe(true);
  await submitMistakePractice(
    db,
    owner,
    'en',
    { ...practice(), answer: { type: 'multiple_choice', optionId: 'sent' } },
    later,
  );
  const tomorrow = await getTodayDaily(
    db,
    owner,
    new Date('2030-01-03T12:00:00Z'),
  );
  expect(tomorrow.preview!.some((i) => i.kind === 'mistake')).toBe(false);
});

it('creates new identities on local rollover and language changes without rewriting old snapshots', async () => {
  const first = await startDailySession(
    db,
    owner,
    new Date('2030-01-02T21:59:59Z'),
  );
  const second = await startDailySession(
    db,
    owner,
    new Date('2030-01-02T22:00:00Z'),
  );
  expect(second).not.toBe(first);
  expect((await plan(first)).session.studyDate).toBe('2030-01-02');
  expect((await plan(second)).session.studyDate).toBe('2030-01-03');
  await local
    .update(schema.learnerProfiles)
    .set({ learningLanguage: 'ro' })
    .where(eq(schema.learnerProfiles.userId, owner));
  const today = await getTodayDaily(db, owner, now);
  expect(today.preview).toEqual([]);
  await expect(startDailySession(db, owner, now)).rejects.toMatchObject({
    code: 'no_work',
  });
  await local
    .update(schema.learnerProfiles)
    .set({ learningLanguage: 'en' })
    .where(eq(schema.learnerProfiles.userId, owner));
  expect(await startDailySession(db, owner, now)).toBe(first);
});

it('resolves unavailable lesson versions and unpublished weakness mappings without replanning or source writes', async () => {
  await mixedFixture();
  const id = await startDailySession(db, owner, now);
  try {
    await local
      .update(schema.lessons)
      .set({ contentVersion: 3 })
      .where(eq(schema.lessons.id, 'en-b1-present-perfect'));
    await local
      .update(schema.weaknessDefinitions)
      .set({ isPublished: false })
      .where(eq(schema.weaknessDefinitions.id, 'en-past-present-perfect'));
    const daily = await plan(id);
    expect(
      daily.items.filter((i) => i.kind !== 'review').map((i) => i.status),
    ).toEqual(['unavailable', 'unavailable']);
    expect(
      daily.items.find((i) => i.kind === 'lesson')!.lessonContentVersion,
    ).toBe(2);
    expect(
      (await local.select().from(schema.lessonProgress))[0].contentVersion,
    ).toBe(2);
    expect(
      await local.select().from(schema.mistakePracticeAttempts),
    ).toHaveLength(0);
  } finally {
    await local
      .update(schema.lessons)
      .set({ contentVersion: 2 })
      .where(eq(schema.lessons.id, 'en-b1-present-perfect'));
    await local
      .update(schema.weaknessDefinitions)
      .set({ isPublished: true })
      .where(eq(schema.weaknessDefinitions.id, 'en-past-present-perfect'));
  }
  expect(
    (await plan(id)).items
      .filter((i) => i.kind !== 'review')
      .every((i) => i.status === 'unavailable'),
  ).toBe(true);
});

it('enforces immutable snapshots, source targets, bounded totals and owner cascade', async () => {
  const id = await startDailySession(db, owner, now);
  const daily = await plan(id);
  await expect(
    local
      .update(schema.dailySessions)
      .set({ targetMinutes: 60 })
      .where(eq(schema.dailySessions.id, id)),
  ).rejects.toThrow();
  await expect(
    local
      .update(schema.dailySessionItems)
      .set({ targetPosition: 99 })
      .where(eq(schema.dailySessionItems.id, daily.items[0].id)),
  ).rejects.toThrow();
  await expect(
    local
      .delete(schema.dailySessionItems)
      .where(eq(schema.dailySessionItems.sessionId, id)),
  ).rejects.toThrow();
  await expect(
    local.insert(schema.dailySessions).values({
      userId: owner,
      languageCode: 'en',
      studyDate: '2030-01-02',
      timezone: 'UTC',
      targetMinutes: 5,
      plannedMinutes: 6,
      plannerVersion: 'daily-v1',
      createdAt: now,
    }),
  ).rejects.toThrow();
  await local.delete(schema.users).where(eq(schema.users.id, owner));
  expect(await local.select().from(schema.dailySessions)).toHaveLength(0);
  expect(await local.select().from(schema.dailySessionItems)).toHaveLength(0);
});
