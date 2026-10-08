export const PLANNER_VERSION = 'daily-v1';
export const ESTIMATES = {
  review: 0.5,
  mistake: 2,
  maxReviews: 20,
  maxMistakes: 3,
  reviewShare: 0.4,
  mistakeShare: 0.2,
} as const;

export type LessonCandidate = {
  id: string;
  title: string;
  contentVersion: number;
  position: number;
  estimatedMinutes: number;
  activities: { focus: string[] }[];
};
export type MistakeCandidate = { id: string; label: string };
export type PlanItem = {
  kind: 'review' | 'lesson' | 'mistake';
  label: string;
  focus: string[];
  estimatedMinutes: number;
  targetCount: number;
  lessonId: string | null;
  lessonContentVersion: number | null;
  startPosition: number | null;
  targetPosition: number | null;
  weaknessId: string | null;
};
const refs = {
  lessonId: null,
  lessonContentVersion: null,
  startPosition: null,
  targetPosition: null,
  weaknessId: null,
};

/** Half-minute estimates; never presented as measured study time. */
export function lessonBlockMinutes(lesson: LessonCandidate) {
  return Math.min(
    3,
    Math.max(
      0.5,
      Math.ceil((lesson.estimatedMinutes / lesson.activities.length) * 2) / 2,
    ),
  );
}

/** Inputs are already scoped and ranked by trusted source repositories. */
export function planDaily(input: {
  targetMinutes: number;
  dueCount: number;
  lesson: LessonCandidate | null;
  mistakes: MistakeCandidate[];
}): PlanItem[] {
  const { targetMinutes: budget, lesson } = input;
  const mistakes = input.mistakes.slice(0, ESTIMATES.maxMistakes);
  const availableReviews = Math.min(input.dueCount, ESTIMATES.maxReviews);
  const block = lesson ? lessonBlockMinutes(lesson) : 0;
  const remainingBlocks = lesson
    ? lesson.activities.length - lesson.position
    : 0;
  const lessonReserve = remainingBlocks > 0 && block <= budget ? block : 0;
  const mistakeReserve =
    mistakes.length && budget - lessonReserve >= ESTIMATES.mistake
      ? ESTIMATES.mistake
      : 0;
  let reviews = Math.min(
    availableReviews,
    Math.floor(
      Math.min(
        budget * ESTIMATES.reviewShare,
        budget - lessonReserve - mistakeReserve,
      ) / ESTIMATES.review,
    ),
  );
  let remaining = budget - reviews * ESTIMATES.review;
  let practices = Math.min(
    mistakes.length,
    Math.max(
      1,
      Math.floor((budget * ESTIMATES.mistakeShare) / ESTIMATES.mistake),
    ),
    Math.floor((remaining - lessonReserve) / ESTIMATES.mistake),
  );
  remaining -= practices * ESTIMATES.mistake;
  const blocks = lesson
    ? Math.min(remainingBlocks, Math.floor(remaining / block))
    : 0;
  remaining -= blocks * block;
  const moreReviews = Math.min(
    availableReviews - reviews,
    Math.floor(remaining / ESTIMATES.review),
  );
  reviews += moreReviews;
  remaining -= moreReviews * ESTIMATES.review;
  practices += Math.min(
    mistakes.length - practices,
    Math.floor(remaining / ESTIMATES.mistake),
  );
  const items: PlanItem[] = [];
  if (reviews)
    items.push({
      ...refs,
      kind: 'review',
      label: 'Review due vocabulary',
      focus: ['vocabulary'],
      estimatedMinutes: reviews * ESTIMATES.review,
      targetCount: reviews,
    });
  for (const mistake of mistakes.slice(0, practices))
    items.push({
      ...refs,
      kind: 'mistake',
      label: mistake.label,
      focus: ['corrective practice'],
      estimatedMinutes: ESTIMATES.mistake,
      targetCount: 1,
      weaknessId: mistake.id,
    });
  if (lesson && blocks)
    items.push({
      ...refs,
      kind: 'lesson',
      label: lesson.title,
      focus: [
        ...new Set(
          lesson.activities
            .slice(lesson.position, lesson.position + blocks)
            .flatMap((a) => a.focus),
        ),
      ],
      estimatedMinutes: blocks * block,
      targetCount: blocks,
      lessonId: lesson.id,
      lessonContentVersion: lesson.contentVersion,
      startPosition: lesson.position,
      targetPosition: lesson.position + blocks,
    });
  return items;
}
