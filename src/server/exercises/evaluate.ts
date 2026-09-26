import type { ExerciseActivity } from '../../content/activity-schema';
import {
  exerciseAnswerSchema,
  type ExerciseAnswer,
  type GradingResult,
} from '../../lib/exercise-answer';
import type { z } from 'zod';
import type { normalizationSchema } from '../../content/activity-schema';

export class AnswerError extends Error {
  constructor() {
    super('Invalid answer for this exercise.');
  }
}
export function normalizeTextAnswer(
  value: string,
  policy: z.infer<typeof normalizationSchema>,
) {
  let normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!policy.caseSensitive) normalized = normalized.toLowerCase();
  if (policy.terminalPunctuation === 'ignore')
    normalized = normalized.replace(/[.!?]+$/u, '').trimEnd();
  return normalized;
}
const sameIds = (ids: string[], known: string[]) =>
  ids.length === known.length &&
  new Set(ids).size === known.length &&
  ids.every((id) => known.includes(id));

export function evaluateExercise(
  activity: ExerciseActivity,
  raw: unknown,
): { answer: ExerciseAnswer; result: GradingResult } {
  const parsed = exerciseAnswerSchema.safeParse(raw);
  if (!parsed.success || parsed.data.type !== activity.type)
    throw new AnswerError();
  const answer = parsed.data;
  let isCorrect = false;
  let score = 0;
  let expectedAnswer = '';
  let feedback = '';
  if (
    activity.type === 'multiple_choice' &&
    answer.type === 'multiple_choice'
  ) {
    const selected = activity.payload.options.find(
      (option) => option.id === answer.optionId,
    );
    if (!selected) throw new AnswerError();
    isCorrect = answer.optionId === activity.payload.correctOptionId;
    expectedAnswer = activity.payload.options.find(
      (option) => option.id === activity.payload.correctOptionId,
    )!.text;
    feedback = selected.feedback ?? '';
    score = isCorrect ? 1 : 0;
  } else if (
    activity.type === 'sentence_reorder' &&
    answer.type === 'sentence_reorder'
  ) {
    if (
      !sameIds(
        answer.tokenIds,
        activity.payload.tokens.map((token) => token.id),
      )
    )
      throw new AnswerError();
    isCorrect = answer.tokenIds.every(
      (id, index) => id === activity.payload.correctOrder[index],
    );
    expectedAnswer = activity.payload.correctOrder
      .map(
        (id) => activity.payload.tokens.find((token) => token.id === id)!.text,
      )
      .join(' ');
    score = isCorrect ? 1 : 0;
  } else if (activity.type === 'matching' && answer.type === 'matching') {
    if (
      !sameIds(
        answer.pairs.map((pair) => pair.leftId),
        activity.payload.left.map((item) => item.id),
      ) ||
      !sameIds(
        answer.pairs.map((pair) => pair.rightId),
        activity.payload.right.map((item) => item.id),
      )
    )
      throw new AnswerError();
    const correct = activity.payload.correctPairs.filter((pair) =>
      answer.pairs.some(
        (submitted) =>
          pair.leftId === submitted.leftId &&
          pair.rightId === submitted.rightId,
      ),
    ).length;
    score = correct / activity.payload.correctPairs.length;
    isCorrect = score === 1;
    expectedAnswer = activity.payload.correctPairs
      .map(
        (pair) =>
          `${activity.payload.left.find((item) => item.id === pair.leftId)!.text} → ${activity.payload.right.find((item) => item.id === pair.rightId)!.text}`,
      )
      .join('; ');
    feedback = `${correct} of ${activity.payload.correctPairs.length} pairs matched.`;
  } else if ('acceptedAnswers' in activity.payload && 'text' in answer) {
    const payload = activity.payload;
    isCorrect = payload.acceptedAnswers.some(
      (expected) =>
        normalizeTextAnswer(expected, payload.normalization) ===
        normalizeTextAnswer(answer.text, payload.normalization),
    );
    expectedAnswer = payload.acceptedAnswers[0];
    score = isCorrect ? 1 : 0;
  } else throw new AnswerError();
  return {
    answer,
    result: {
      isCorrect,
      score,
      expectedAnswer,
      explanation: activity.explanation,
      feedback:
        feedback ||
        (isCorrect
          ? 'Well done. Your answer fits this context.'
          : 'A useful contrast to practise. Compare your answer with the model below.'),
    },
  };
}
