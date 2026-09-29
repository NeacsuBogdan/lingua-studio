import { and, asc, count, eq, gt, gte, lte, sql } from 'drizzle-orm';
import type { getDb } from '../db/client';
import {
  reviewCards,
  reviewHistory,
  reviewSessionItems,
  reviewSessions,
  userVocabulary,
  users,
  vocabularyEvidence,
  vocabularyExamples,
  vocabularySenses,
} from '../db/schema';
import {
  emptyCard,
  fromRow,
  SCHEDULER_VERSION,
  schedule,
  toColumns,
  type ReviewRating,
} from './scheduler';

type Database = ReturnType<typeof getDb>;
export const REVIEW_BATCH_SIZE = 20;
export class ReviewError extends Error {
  constructor(public code: 'not_found' | 'stale' | 'invalid' | 'not_due') {
    super(code);
  }
}

/** Called inside the same transaction as an introduction or trusted practice event. */
export async function ensureReviewCard(
  db: Database,
  userId: string,
  senseId: string,
  now: Date,
) {
  const [row] = await db
    .insert(reviewCards)
    .values({
      userId,
      senseId,
      kind: 'recognition',
      ...toColumns(emptyCard(now)),
      schedulerVersion: SCHEDULER_VERSION,
    })
    .onConflictDoNothing({
      target: [reviewCards.userId, reviewCards.senseId, reviewCards.kind],
    })
    .returning({ id: reviewCards.id });
  return Boolean(row);
}

/** Explicit, repeatable bootstrap: eligibility creates New cards, never fake reviews. */
export async function backfillEligibleCards(db: Database, now: Date) {
  const eligible = await db
    .selectDistinct({
      userId: userVocabulary.userId,
      senseId: userVocabulary.senseId,
    })
    .from(userVocabulary)
    .where(sql`${userVocabulary.introducedAt} is not null`);
  const practice = await db
    .selectDistinct({
      userId: vocabularyEvidence.userId,
      senseId: vocabularyEvidence.senseId,
    })
    .from(vocabularyEvidence);
  const seen = new Set<string>();
  let created = 0;
  for (const row of [...eligible, ...practice]) {
    const key = `${row.userId}:${row.senseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (await ensureReviewCard(db, row.userId, row.senseId, now)) created++;
  }
  return { eligible: seen.size, created };
}

export async function getDueCount(
  db: Database,
  userId: string,
  languageCode: string,
  now: Date,
) {
  const [row] = await db
    .select({ total: count() })
    .from(reviewCards)
    .innerJoin(vocabularySenses, eq(reviewCards.senseId, vocabularySenses.id))
    .where(
      and(
        eq(reviewCards.userId, userId),
        eq(vocabularySenses.languageCode, languageCode),
        eq(vocabularySenses.isPublished, true),
        lte(reviewCards.due, now),
      ),
    );
  return row.total;
}

export async function getReviewCardSummary(
  db: Database,
  userId: string,
  senseId: string,
  now: Date,
) {
  const [card] = await db
    .select({
      id: reviewCards.id,
      state: reviewCards.state,
      due: reviewCards.due,
      reps: reviewCards.reps,
    })
    .from(reviewCards)
    .where(
      and(
        eq(reviewCards.userId, userId),
        eq(reviewCards.senseId, senseId),
        eq(reviewCards.kind, 'recognition'),
      ),
    )
    .limit(1);
  if (!card) return null;
  const [row] = await db
    .select({ total: count() })
    .from(reviewHistory)
    .where(
      and(eq(reviewHistory.userId, userId), eq(reviewHistory.cardId, card.id)),
    );
  return {
    state: ['New', 'Learning', 'Review', 'Relearning'][card.state] ?? 'New',
    due: card.due,
    dueNow: card.due <= now,
    reviewCount: row.total,
  };
}

export async function getReviewOverview(
  db: Database,
  userId: string,
  languageCode: string,
  now: Date,
) {
  const [dueCount, next, recent, active] = await Promise.all([
    getDueCount(db, userId, languageCode, now),
    db
      .select({ due: reviewCards.due })
      .from(reviewCards)
      .innerJoin(vocabularySenses, eq(reviewCards.senseId, vocabularySenses.id))
      .where(
        and(
          eq(reviewCards.userId, userId),
          eq(vocabularySenses.languageCode, languageCode),
          eq(vocabularySenses.isPublished, true),
          gt(reviewCards.due, now),
        ),
      )
      .orderBy(asc(reviewCards.due))
      .limit(1),
    db
      .select({ rating: reviewHistory.rating })
      .from(reviewHistory)
      .innerJoin(
        vocabularySenses,
        eq(reviewHistory.senseId, vocabularySenses.id),
      )
      .where(
        and(
          eq(reviewHistory.userId, userId),
          eq(vocabularySenses.languageCode, languageCode),
          gte(reviewHistory.reviewedAt, new Date(now.getTime() - 7 * 86400000)),
        ),
      ),
    db
      .select({
        id: reviewSessions.id,
        languageCode: reviewSessions.languageCode,
      })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.userId, userId),
          eq(reviewSessions.status, 'active'),
        ),
      )
      .limit(1),
  ]);
  return {
    dueCount,
    nextDue: next[0]?.due ?? null,
    activeSessionId:
      active[0]?.languageCode === languageCode ? active[0].id : null,
    activeOtherLanguage:
      active[0]?.languageCode !== languageCode
        ? (active[0]?.languageCode ?? null)
        : null,
    recentCount: recent.length,
    ratings: {
      Again: recent.filter((row) => row.rating === 1).length,
      Hard: recent.filter((row) => row.rating === 2).length,
      Good: recent.filter((row) => row.rating === 3).length,
      Easy: recent.filter((row) => row.rating === 4).length,
    },
  };
}

export async function startReviewSession(
  db: Database,
  userId: string,
  languageCode: string,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    const [active] = await tx
      .select({ id: reviewSessions.id })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.userId, userId),
          eq(reviewSessions.status, 'active'),
        ),
      )
      .limit(1);
    if (active) return active.id;
    const [otherActive] = await tx
      .select({ id: reviewSessions.id })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.userId, userId),
          eq(reviewSessions.status, 'active'),
        ),
      )
      .limit(1);
    if (otherActive) throw new ReviewError('stale');
    const due = await tx
      .select({ id: reviewCards.id, revision: reviewCards.revision })
      .from(reviewCards)
      .innerJoin(vocabularySenses, eq(reviewCards.senseId, vocabularySenses.id))
      .where(
        and(
          eq(reviewCards.userId, userId),
          eq(vocabularySenses.languageCode, languageCode),
          eq(vocabularySenses.isPublished, true),
          lte(reviewCards.due, now),
        ),
      )
      .orderBy(asc(reviewCards.due), asc(reviewCards.id))
      .limit(REVIEW_BATCH_SIZE);
    if (!due.length) return null;
    const [session] = await database
      .insert(reviewSessions)
      .values({ userId, languageCode })
      .returning({ id: reviewSessions.id });
    await database.insert(reviewSessionItems).values(
      due.map((card, index) => ({
        sessionId: session.id,
        cardId: card.id,
        position: index + 1,
        expectedRevision: card.revision,
      })),
    );
    return session.id;
  });
}

export async function getReviewSession(
  db: Database,
  userId: string,
  languageCode: string,
  sessionId: string,
  now: Date,
) {
  const [session] = await db
    .select()
    .from(reviewSessions)
    .where(
      and(eq(reviewSessions.id, sessionId), eq(reviewSessions.userId, userId)),
    )
    .limit(1);
  if (!session || session.languageCode !== languageCode)
    throw new ReviewError('not_found');
  const items = await db
    .select({
      item: reviewSessionItems,
      card: reviewCards,
      sense: vocabularySenses,
    })
    .from(reviewSessionItems)
    .innerJoin(reviewCards, eq(reviewSessionItems.cardId, reviewCards.id))
    .innerJoin(vocabularySenses, eq(reviewCards.senseId, vocabularySenses.id))
    .where(
      and(
        eq(reviewSessionItems.sessionId, sessionId),
        eq(reviewCards.userId, userId),
        eq(vocabularySenses.languageCode, languageCode),
      ),
    )
    .orderBy(asc(reviewSessionItems.position));
  const current = items.find((row) => row.item.status === 'pending') ?? null;
  const summary = await db
    .select({ rating: reviewHistory.rating })
    .from(reviewHistory)
    .where(
      and(
        eq(reviewHistory.userId, userId),
        eq(reviewHistory.sessionId, sessionId),
      ),
    );
  return {
    id: session.id,
    status: session.status,
    size: items.length,
    reviewed: summary.length,
    stale: items.filter((row) => row.item.status === 'stale').length,
    current: current
      ? {
          itemId: current.item.id,
          cardId: current.card.id,
          position: current.item.position,
          headword: current.sense.displayForm,
          partOfSpeech: current.sense.partOfSpeech,
          due: current.card.due,
          reviewable:
            current.card.revision === current.item.expectedRevision &&
            current.card.due <= now,
        }
      : null,
    ratings: {
      Again: summary.filter((row) => row.rating === 1).length,
      Hard: summary.filter((row) => row.rating === 2).length,
      Good: summary.filter((row) => row.rating === 3).length,
      Easy: summary.filter((row) => row.rating === 4).length,
    },
  };
}

export async function getReviewAnswer(
  db: Database,
  userId: string,
  languageCode: string,
  sessionId: string,
  itemId: string,
  now: Date,
) {
  const [earliest] = await db
    .select({ id: reviewSessionItems.id })
    .from(reviewSessionItems)
    .innerJoin(
      reviewSessions,
      eq(reviewSessionItems.sessionId, reviewSessions.id),
    )
    .where(
      and(
        eq(reviewSessions.id, sessionId),
        eq(reviewSessions.userId, userId),
        eq(reviewSessions.status, 'active'),
        eq(reviewSessions.languageCode, languageCode),
        eq(reviewSessionItems.status, 'pending'),
      ),
    )
    .orderBy(asc(reviewSessionItems.position))
    .limit(1);
  if (earliest?.id !== itemId) throw new ReviewError('not_found');
  const [row] = await db
    .select({
      item: reviewSessionItems,
      due: reviewCards.due,
      revision: reviewCards.revision,
      definition: vocabularySenses.definition,
      notes: vocabularySenses.notes,
      senseId: vocabularySenses.id,
    })
    .from(reviewSessionItems)
    .innerJoin(
      reviewSessions,
      eq(reviewSessionItems.sessionId, reviewSessions.id),
    )
    .innerJoin(reviewCards, eq(reviewSessionItems.cardId, reviewCards.id))
    .innerJoin(vocabularySenses, eq(reviewCards.senseId, vocabularySenses.id))
    .where(
      and(
        eq(reviewSessions.id, sessionId),
        eq(reviewSessions.userId, userId),
        eq(reviewSessions.status, 'active'),
        eq(reviewSessions.languageCode, languageCode),
        eq(reviewSessionItems.id, itemId),
        eq(reviewSessionItems.status, 'pending'),
        eq(reviewCards.userId, userId),
        eq(vocabularySenses.languageCode, languageCode),
      ),
    )
    .limit(1);
  if (!row) throw new ReviewError('not_found');
  if (row.item.expectedRevision !== row.revision || row.due > now)
    throw new ReviewError('stale');
  const [example] = await db
    .select({ sentence: vocabularyExamples.sentence })
    .from(vocabularyExamples)
    .where(eq(vocabularyExamples.senseId, row.senseId))
    .orderBy(asc(vocabularyExamples.id))
    .limit(1);
  return {
    definition: row.definition,
    notes: row.notes,
    example: example?.sentence ?? null,
  };
}

export async function skipStaleReviewItem(
  db: Database,
  userId: string,
  languageCode: string,
  sessionId: string,
  itemId: string,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, sessionId),
          eq(reviewSessions.userId, userId),
          eq(reviewSessions.status, 'active'),
        ),
      )
      .for('update');
    if (!session || session.languageCode !== languageCode)
      throw new ReviewError('not_found');
    const [item] = await tx
      .select()
      .from(reviewSessionItems)
      .where(
        and(
          eq(reviewSessionItems.id, itemId),
          eq(reviewSessionItems.sessionId, sessionId),
        ),
      )
      .for('update');
    if (!item || item.status !== 'pending') throw new ReviewError('stale');
    const [card] = await tx
      .select()
      .from(reviewCards)
      .where(
        and(eq(reviewCards.id, item.cardId), eq(reviewCards.userId, userId)),
      )
      .for('update');
    if (card && card.revision === item.expectedRevision && card.due <= now)
      throw new ReviewError('invalid');
    await tx
      .update(reviewSessionItems)
      .set({ status: 'stale' })
      .where(eq(reviewSessionItems.id, item.id));
  });
}

export async function submitReview(
  db: Database,
  userId: string,
  languageCode: string,
  request: {
    sessionId: string;
    itemId: string;
    cardId: string;
    submissionId: string;
    rating: ReviewRating;
  },
  now: Date,
) {
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    const [session] = await tx
      .select()
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, request.sessionId),
          eq(reviewSessions.userId, userId),
        ),
      )
      .for('update');
    if (!session || session.languageCode !== languageCode)
      throw new ReviewError('not_found');
    const [replay] = await tx
      .select()
      .from(reviewHistory)
      .where(
        and(
          eq(reviewHistory.userId, userId),
          eq(reviewHistory.submissionId, request.submissionId),
        ),
      )
      .limit(1);
    if (replay) {
      if (
        replay.sessionId !== request.sessionId ||
        replay.itemId !== request.itemId ||
        replay.cardId !== request.cardId ||
        replay.rating !==
          ['Again', 'Hard', 'Good', 'Easy'].indexOf(request.rating) + 1
      )
        throw new ReviewError('invalid');
      return { historyId: replay.id, due: replay.afterDue, replay: true };
    }
    if (session.status !== 'active') throw new ReviewError('stale');
    const [item] = await tx
      .select()
      .from(reviewSessionItems)
      .where(
        and(
          eq(reviewSessionItems.id, request.itemId),
          eq(reviewSessionItems.sessionId, session.id),
        ),
      )
      .for('update');
    if (!item || item.cardId !== request.cardId || item.status !== 'pending')
      throw new ReviewError('stale');
    const [earliest] = await tx
      .select({ id: reviewSessionItems.id })
      .from(reviewSessionItems)
      .where(
        and(
          eq(reviewSessionItems.sessionId, session.id),
          eq(reviewSessionItems.status, 'pending'),
        ),
      )
      .orderBy(asc(reviewSessionItems.position))
      .limit(1);
    if (earliest?.id !== item.id) throw new ReviewError('stale');
    const [card] = await tx
      .select()
      .from(reviewCards)
      .where(
        and(eq(reviewCards.id, item.cardId), eq(reviewCards.userId, userId)),
      )
      .for('update');
    if (
      !card ||
      card.revision !== item.expectedRevision ||
      card.due > now ||
      card.schedulerVersion !== SCHEDULER_VERSION
    )
      throw new ReviewError('not_due');
    const [sense] = await tx
      .select({ id: vocabularySenses.id })
      .from(vocabularySenses)
      .where(
        and(
          eq(vocabularySenses.id, card.senseId),
          eq(vocabularySenses.languageCode, languageCode),
          eq(vocabularySenses.isPublished, true),
        ),
      )
      .limit(1);
    if (!sense) throw new ReviewError('not_found');
    const next = schedule(fromRow(card), request.rating, now);
    const [updated] = await database
      .update(reviewCards)
      .set({
        ...toColumns(next.card),
        revision: card.revision + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(reviewCards.id, card.id),
          eq(reviewCards.userId, userId),
          eq(reviewCards.revision, card.revision),
        ),
      )
      .returning({ id: reviewCards.id });
    if (!updated) throw new ReviewError('stale');
    const [history] = await database
      .insert(reviewHistory)
      .values({
        userId,
        cardId: card.id,
        senseId: card.senseId,
        sessionId: session.id,
        itemId: item.id,
        submissionId: request.submissionId,
        rating: next.log.rating,
        reviewedAt: now,
        beforeDue: card.due,
        afterDue: next.card.due,
        beforeState: card.state,
        afterState: next.card.state,
        beforeStability: card.stability,
        afterStability: next.card.stability,
        beforeDifficulty: card.difficulty,
        afterDifficulty: next.card.difficulty,
        scheduledDays: next.card.scheduled_days,
        schedulerVersion: SCHEDULER_VERSION,
      })
      .returning({ id: reviewHistory.id });
    await database
      .update(reviewSessionItems)
      .set({ status: 'reviewed' })
      .where(eq(reviewSessionItems.id, item.id));
    return { historyId: history.id, due: next.card.due, replay: false };
  });
}

export async function finishReviewSession(
  db: Database,
  userId: string,
  sessionId: string,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, sessionId),
          eq(reviewSessions.userId, userId),
        ),
      )
      .for('update');
    if (!session) throw new ReviewError('not_found');
    if (session.status === 'completed') return true;
    const [pending] = await tx
      .select({ id: reviewSessionItems.id })
      .from(reviewSessionItems)
      .where(
        and(
          eq(reviewSessionItems.sessionId, session.id),
          eq(reviewSessionItems.status, 'pending'),
        ),
      )
      .limit(1);
    if (pending) throw new ReviewError('stale');
    await tx
      .update(reviewSessions)
      .set({ status: 'completed', completedAt: now })
      .where(eq(reviewSessions.id, session.id));
    return true;
  });
}
