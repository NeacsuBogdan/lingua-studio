import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { getDb } from '../db/client';
import {
  activityVocabulary,
  dailySessionItems,
  dailySessions,
  learnerProfiles,
  lessonProgress,
  mistakePracticeAttempts,
  reviewCards,
  reviewHistory,
  users,
  vocabularySenses,
} from '../db/schema';
import { CourseError, getCourseMap, getLessonView } from '../course/repository';
import {
  getMistakePractice,
  listWeaknesses,
  MistakeError,
} from '../mistakes/repository';
import { getReviewOverview } from '../review/repository';
import {
  planDaily,
  PLANNER_VERSION,
  type LessonCandidate,
  type PlanItem,
} from './planner';
import { studyDate } from './study-date';

type Database = ReturnType<typeof getDb>;
type DailySession = typeof dailySessions.$inferSelect;
type DailyItem = typeof dailySessionItems.$inferSelect;
export class DailyError extends Error {
  constructor(public code: 'profile' | 'no_work' | 'not_found') {
    super(code);
  }
}

async function profileFor(db: Database, userId: string) {
  const [profile] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, userId));
  if (!profile) throw new DailyError('profile');
  return profile;
}

async function candidates(
  db: Database,
  userId: string,
  languageCode: string,
  now: Date,
) {
  const [course, review, weaknesses] = await Promise.all([
    getCourseMap(db, userId, languageCode),
    getReviewOverview(db, userId, languageCode, now),
    listWeaknesses(db, userId, languageCode),
  ]);
  let lesson: LessonCandidate | null = null;
  if (course?.recommended) {
    const view = await getLessonView(
      db,
      userId,
      languageCode,
      course.recommended.id,
    );
    const links = view.activities.length
      ? await db
          .select({ activityId: activityVocabulary.activityId })
          .from(activityVocabulary)
          .where(
            and(
              inArray(
                activityVocabulary.activityId,
                view.activities.map((a) => a.id),
              ),
              inArray(activityVocabulary.role, ['introduces', 'practises']),
            ),
          )
      : [];
    const vocabulary = new Set(links.map((l) => l.activityId));
    lesson = {
      id: view.lesson.id,
      title: view.lesson.title,
      contentVersion: view.lesson.contentVersion,
      position: view.lesson.position,
      estimatedMinutes: view.lesson.estimatedMinutes,
      activities: view.activities.map((a) => ({
        focus: [
          ...new Set([
            a.skill,
            ...(vocabulary.has(a.id) ? ['vocabulary'] : []),
          ]),
        ],
      })),
    };
  }
  const ranked = weaknesses
    .filter((w) => w.isPublished && w.status !== 'recovered')
    .sort(
      (a, b) =>
        Number(b.status === 'repeated') - Number(a.status === 'repeated') ||
        b.recurrence - a.recurrence ||
        b.lastSeen.getTime() - a.lastSeen.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const mistakes: { id: string; label: string }[] = [];
  for (const weakness of ranked) {
    try {
      await getMistakePractice(db, userId, languageCode, weakness.id);
      mistakes.push({ id: weakness.id, label: weakness.label });
      if (mistakes.length === 3) break;
    } catch (error) {
      if (!(error instanceof MistakeError)) throw error;
    }
  }
  return {
    lesson,
    mistakes,
    dueCount: review.activeOtherLanguage ? 0 : review.dueCount,
  };
}

async function evidenceCount(
  db: Database,
  session: Pick<DailySession, 'userId' | 'languageCode' | 'createdAt'>,
  item: Pick<PlanItem, 'kind' | 'weaknessId'>,
  until?: Date,
) {
  if (item.kind === 'review') {
    const [r] = await db
      .select({ total: sql<number>`count(*)::integer` })
      .from(reviewHistory)
      .innerJoin(
        vocabularySenses,
        eq(reviewHistory.senseId, vocabularySenses.id),
      )
      .where(
        and(
          eq(reviewHistory.userId, session.userId),
          eq(vocabularySenses.languageCode, session.languageCode),
          gte(reviewHistory.reviewedAt, session.createdAt),
          until ? lte(reviewHistory.reviewedAt, until) : undefined,
        ),
      );
    return r.total;
  }
  if (item.kind === 'mistake') {
    const [r] = await db
      .select({ total: sql<number>`count(*)::integer` })
      .from(mistakePracticeAttempts)
      .where(
        and(
          eq(mistakePracticeAttempts.userId, session.userId),
          eq(mistakePracticeAttempts.weaknessId, item.weaknessId!),
          gte(mistakePracticeAttempts.createdAt, session.createdAt),
          until ? lte(mistakePracticeAttempts.createdAt, until) : undefined,
        ),
      );
    return r.total;
  }
  return 0;
}

/** Explicit Start is the only Daily creation operation. Serialize by learner. */
export async function startDailySession(
  db: Database,
  userId: string,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    await tx
      .select({ id: learnerProfiles.userId })
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, userId))
      .for('share');
    const profile = await profileFor(database, userId);
    const date = studyDate(now, profile.timezone);
    const [existing] = await tx
      .select()
      .from(dailySessions)
      .where(
        and(
          eq(dailySessions.userId, userId),
          eq(dailySessions.languageCode, profile.learningLanguage),
          eq(dailySessions.studyDate, date),
        ),
      );
    if (existing) return existing.id;
    const items = planDaily({
      targetMinutes: profile.dailyMinutes,
      ...(await candidates(database, userId, profile.learningLanguage, now)),
    });
    if (!items.length) throw new DailyError('no_work');
    const [session] = await tx
      .insert(dailySessions)
      .values({
        userId,
        languageCode: profile.learningLanguage,
        studyDate: date,
        timezone: profile.timezone,
        targetMinutes: profile.dailyMinutes,
        plannedMinutes: items.reduce(
          (sum, item) => sum + item.estimatedMinutes,
          0,
        ),
        plannerVersion: PLANNER_VERSION,
        createdAt: now,
      })
      .returning();
    for (const [index, item] of items.entries())
      await tx.insert(dailySessionItems).values({
        ...item,
        sessionId: session.id,
        position: index + 1,
        // Also excludes pre-existing evidence tied to, or later than, the cutoff.
        baselineCount: await evidenceCount(database, session, item),
      });
    return session.id;
  });
}

async function progressFor(
  db: Database,
  session: DailySession,
  item: DailyItem,
  now: Date,
) {
  if (item.kind !== 'lesson') {
    const units = Math.max(
      item.completedUnits,
      Math.min(
        item.targetCount,
        Math.max(
          0,
          (await evidenceCount(db, session, item as PlanItem, now)) -
            item.baselineCount,
        ),
      ),
    );
    if (units === item.targetCount) return { units, unavailable: false };
    if (item.kind === 'mistake') {
      try {
        await getMistakePractice(
          db,
          session.userId,
          session.languageCode,
          item.weaknessId!,
        );
      } catch (error) {
        if (error instanceof MistakeError) return { units, unavailable: true };
        throw error;
      }
    } else {
      const [card] = await db
        .select({ id: reviewCards.id })
        .from(reviewCards)
        .innerJoin(
          vocabularySenses,
          eq(reviewCards.senseId, vocabularySenses.id),
        )
        .where(
          and(
            eq(reviewCards.userId, session.userId),
            eq(vocabularySenses.languageCode, session.languageCode),
            eq(vocabularySenses.isPublished, true),
          ),
        )
        .limit(1);
      if (!card) return { units, unavailable: true };
    }
    return { units, unavailable: false };
  }
  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, session.userId),
        eq(lessonProgress.lessonId, item.lessonId!),
        eq(lessonProgress.contentVersion, item.lessonContentVersion!),
      ),
    );
  const units = Math.max(
    item.completedUnits,
    Math.min(
      item.targetCount,
      Math.max(0, (progress?.position ?? 0) - item.startPosition!),
    ),
  );
  if (units === item.targetCount) return { units, unavailable: false };
  try {
    const view = await getLessonView(
      db,
      session.userId,
      session.languageCode,
      item.lessonId!,
    );
    return {
      units,
      unavailable:
        view.lesson.contentVersion !== item.lessonContentVersion ||
        view.lesson.state === 'locked' ||
        view.activities.length < item.targetPosition!,
    };
  } catch (error) {
    if (error instanceof CourseError) return { units, unavailable: true };
    throw error;
  }
}

/** Read/reconcile owned plans only; writes derived Daily progress, never sources. */
export async function getDailySession(
  db: Database,
  userId: string,
  languageCode: string,
  sessionId: string,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    const [session] = await tx
      .select()
      .from(dailySessions)
      .where(
        and(
          eq(dailySessions.id, sessionId),
          eq(dailySessions.userId, userId),
          eq(dailySessions.languageCode, languageCode),
        ),
      )
      .for('update');
    if (!session) throw new DailyError('not_found');
    const items = await tx
      .select()
      .from(dailySessionItems)
      .where(eq(dailySessionItems.sessionId, session.id))
      .orderBy(asc(dailySessionItems.position));
    if (!session.completedAt) {
      for (const item of items.filter((i) => i.status === 'pending')) {
        const { units, unavailable } = await progressFor(
          database,
          session,
          item,
          now,
        );
        const status =
          units === item.targetCount
            ? 'completed'
            : unavailable
              ? 'unavailable'
              : 'pending';
        if (units !== item.completedUnits || status !== item.status) {
          const changes = {
            completedUnits: units,
            status,
            completedAt: status === 'completed' ? now : null,
            unavailableAt: status === 'unavailable' ? now : null,
          };
          await tx
            .update(dailySessionItems)
            .set(changes)
            .where(eq(dailySessionItems.id, item.id));
          Object.assign(item, changes);
        }
      }
      if (items.length && items.every((i) => i.status !== 'pending')) {
        session.completedAt = now;
        await tx
          .update(dailySessions)
          .set({ completedAt: now })
          .where(eq(dailySessions.id, session.id));
      }
    }
    const review = items.some(
      (i) => i.kind === 'review' && i.status === 'pending',
    )
      ? await getReviewOverview(database, userId, languageCode, now)
      : null;
    return {
      session,
      items: items.map((item) => ({
        ...item,
        href:
          item.kind === 'lesson'
            ? `/course/lesson/${item.lessonId}`
            : item.kind === 'mistake'
              ? `/mistakes/${item.weaknessId}/practice`
              : review?.activeSessionId
                ? `/review/session/${review.activeSessionId}`
                : '/review',
      })),
    };
  });
}

export async function getTodayDaily(db: Database, userId: string, now: Date) {
  const profile = await profileFor(db, userId);
  const date = studyDate(now, profile.timezone);
  const [session] = await db
    .select({ id: dailySessions.id })
    .from(dailySessions)
    .where(
      and(
        eq(dailySessions.userId, userId),
        eq(dailySessions.languageCode, profile.learningLanguage),
        eq(dailySessions.studyDate, date),
      ),
    );
  if (session)
    return {
      date,
      profile,
      plan: await getDailySession(
        db,
        userId,
        profile.learningLanguage,
        session.id,
        now,
      ),
      preview: null,
    };
  return {
    date,
    profile,
    plan: null,
    preview: planDaily({
      targetMinutes: profile.dailyMinutes,
      ...(await candidates(db, userId, profile.learningLanguage, now)),
    }),
  };
}
