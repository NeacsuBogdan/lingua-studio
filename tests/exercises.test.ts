import { describe, expect, it } from 'vitest';
import { englishCatalog } from '../src/content/en/course';
import {
  isExercise,
  learningActivitySchema,
  presentExercise,
  publicExerciseSchema,
} from '../src/content/activity-schema';
import {
  evaluateExercise,
  normalizeTextAnswer,
} from '../src/server/exercises/evaluate';
import { correctAnswer } from './helpers/exercise';

const exercises = englishCatalog.course.levels.flatMap((level) =>
  level.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => lesson.activities.filter(isExercise)),
  ),
);
describe('deterministic evaluators', () => {
  it('covers all seven exercise types with validated authored content', () => {
    expect(new Set(exercises.map((activity) => activity.type)).size).toBe(7);
  });
  for (const activity of exercises) {
    it(`${activity.id}: grades a correct answer and rejects the wrong shape`, () => {
      expect(
        evaluateExercise(activity, correctAnswer(activity)).result,
      ).toMatchObject({
        isCorrect: true,
        score: 1,
        explanation: activity.explanation,
      });
      expect(() =>
        evaluateExercise(activity, {
          type: 'multiple_choice',
          optionId: 'unknown',
          userId: 'forged',
        }),
      ).toThrow();
    });
    it(`${activity.id}: grades an incorrect answer without calling it correct`, () => {
      const answer = correctAnswer(activity);
      if (
        answer.type === 'multiple_choice' &&
        activity.type === 'multiple_choice'
      )
        answer.optionId = activity.payload.options.find(
          (option) => option.id !== activity.payload.correctOptionId,
        )!.id;
      else if (answer.type === 'sentence_reorder')
        answer.tokenIds = [...answer.tokenIds].reverse();
      else if (answer.type === 'matching')
        answer.pairs = answer.pairs.map((pair, index, pairs) => ({
          leftId: pair.leftId,
          rightId: pairs[(index + 1) % pairs.length].rightId,
        }));
      else if ('text' in answer) answer.text = 'This is not a curated answer';
      expect(evaluateExercise(activity, answer).result.isCorrect).toBe(false);
    });
    if ('acceptedAnswers' in activity.payload) {
      for (const text of activity.payload.acceptedAnswers)
        it(`${activity.id}: accepts alternative ${text}`, () => {
          expect(
            evaluateExercise(activity, { type: activity.type, text }).result
              .isCorrect,
          ).toBe(true);
        });
    }
  }
  it('rejects unknown options, missing/repeated tokens and invalid matching IDs', () => {
    const choice = exercises.find(
      (activity) => activity.type === 'multiple_choice',
    )!;
    expect(() =>
      evaluateExercise(choice, {
        type: 'multiple_choice',
        optionId: 'unknown',
      }),
    ).toThrow();
    const reorder = exercises.find(
      (activity) => activity.type === 'sentence_reorder',
    )!;
    expect(() =>
      evaluateExercise(reorder, {
        type: 'sentence_reorder',
        tokenIds: ['when', 'when'],
      }),
    ).toThrow();
    const matching = exercises.find(
      (activity) => activity.type === 'matching',
    )!;
    expect(() =>
      evaluateExercise(matching, {
        type: 'matching',
        pairs: [
          { leftId: 'make', rightId: 'unknown' },
          { leftId: 'take', rightId: 'break' },
        ],
      }),
    ).toThrow();
  });
  it('uses IDs for repeated surface tokens and awards matching partial credit honestly', () => {
    const reorder = learningActivitySchema.parse({
      ...exercises[0],
      type: 'sentence_reorder',
      payload: {
        tokens: [
          { id: 'first', text: 'had' },
          { id: 'second', text: 'had' },
        ],
        correctOrder: ['first', 'second'],
      },
    });
    if (!isExercise(reorder)) throw new Error('Expected exercise');
    expect(
      evaluateExercise(reorder, {
        type: 'sentence_reorder',
        tokenIds: ['second', 'first'],
      }).result.isCorrect,
    ).toBe(false);
    const matching = exercises.find(
      (activity) => activity.type === 'matching',
    )!;
    expect(
      evaluateExercise(matching, {
        type: 'matching',
        pairs: [
          { leftId: 'make', rightId: 'decision' },
          { leftId: 'take', rightId: 'promise' },
          { leftId: 'keep', rightId: 'break' },
        ],
      }).result.score,
    ).toBeCloseTo(1 / 3);
  });
});
describe('text policy', () => {
  const insensitive = {
    caseSensitive: false,
    terminalPunctuation: 'ignore' as const,
  };
  it('normalizes whitespace and NFC Unicode, while preserving accents and internal punctuation', () => {
    expect(normalizeTextAnswer('  CAFE\u0301   now.  ', insensitive)).toBe(
      'café now',
    );
    expect(normalizeTextAnswer('cafe now', insensitive)).not.toBe(
      normalizeTextAnswer('café now', insensitive),
    );
    expect(normalizeTextAnswer("don't", insensitive)).not.toBe(
      normalizeTextAnswer('dont', insensitive),
    );
    expect(normalizeTextAnswer('one, two', insensitive)).not.toBe(
      normalizeTextAnswer('one two', insensitive),
    );
  });
  it('obeys case and terminal punctuation metadata', () => {
    expect(
      normalizeTextAnswer('Hello!', {
        caseSensitive: true,
        terminalPunctuation: 'exact',
      }),
    ).toBe('Hello!');
    expect(normalizeTextAnswer('Hello!', insensitive)).toBe('hello');
  });
});
describe('content and presentation boundaries', () => {
  it('rejects malformed definitions', () => {
    const choice = exercises.find(
      (activity) => activity.type === 'multiple_choice',
    )!;
    expect(
      learningActivitySchema.safeParse({
        ...choice,
        payload: { ...choice.payload, correctOptionId: 'unknown' },
      }).success,
    ).toBe(false);
    const reorder = exercises.find(
      (activity) => activity.type === 'sentence_reorder',
    )!;
    expect(
      learningActivitySchema.safeParse({
        ...reorder,
        payload: { ...reorder.payload, correctOrder: ['unknown'] },
      }).success,
    ).toBe(false);
    const matching = exercises.find(
      (activity) => activity.type === 'matching',
    )!;
    expect(
      learningActivitySchema.safeParse({
        ...matching,
        payload: { ...matching.payload, correctPairs: [] },
      }).success,
    ).toBe(false);
  });
  it('serializes only public fields before submission, including shuffled choices', () => {
    for (const activity of exercises) {
      const presentation = presentExercise(activity);
      expect(publicExerciseSchema.safeParse(presentation).success).toBe(true);
      expect(JSON.stringify(presentation)).not.toMatch(
        /correctOptionId|acceptedAnswers|correctOrder|correctPairs|explanation|feedback|normalization/,
      );
      expect(presentExercise(activity)).toEqual(presentation);
    }
  });
});
