import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import type { reviewCards } from '../db/schema';

export const SCHEDULER_VERSION = 'ts-fsrs-5.4.2-v1';
export const SCHEDULER_CONFIG = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
} as const;
const scheduler = fsrs(SCHEDULER_CONFIG);
export const reviewRatings = ['Again', 'Hard', 'Good', 'Easy'] as const;
export type ReviewRating = (typeof reviewRatings)[number];
const ratingCodes: Record<ReviewRating, Grade> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};
type CardRow = typeof reviewCards.$inferSelect;

export function emptyCard(now: Date): Card {
  return createEmptyCard(now);
}
export function fromRow(row: CardRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ?? undefined,
  };
}
export function toColumns(card: Card) {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}
export function schedule(card: Card, rating: ReviewRating, now: Date) {
  return scheduler.next(card, now, ratingCodes[rating]);
}
