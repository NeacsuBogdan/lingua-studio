import { z } from 'zod';
import { cefrSchema } from './schema';

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const text = z.string().min(1).max(2000);
export const skillSchema = z.enum([
  'grammar',
  'vocabulary',
  'reading',
  'communication',
]);
export const normalizationSchema = z
  .object({
    caseSensitive: z.boolean(),
    terminalPunctuation: z.enum(['exact', 'ignore']),
  })
  .strict();
const base = {
  id,
  order: z.number().int().positive(),
  instructions: text.min(8),
  prompt: text.min(12),
  explanation: text.min(12),
  skill: skillSchema,
  level: cefrSchema,
  tags: z.array(z.string().min(2).max(80)).min(1).max(20),
};
const item = z.object({ id, text }).strict();
const items = z
  .array(item)
  .min(2)
  .max(12)
  .refine(
    (values) => new Set(values.map((value) => value.id)).size === values.length,
    'Item IDs must be unique',
  );
const textPayload = z
  .object({
    acceptedAnswers: z.array(text).min(1).max(12),
    normalization: normalizationSchema,
  })
  .strict();
const studyPayload = z.object({ example: text.min(8) }).strict();
const multipleChoicePayload = z
  .object({
    options: z
      .array(item.extend({ feedback: text.optional() }))
      .min(2)
      .max(8),
    correctOptionId: id,
    shuffleOptions: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.options.map((option) => option.id)).size !==
      value.options.length
    )
      ctx.addIssue({ code: 'custom', message: 'Option IDs must be unique' });
    if (!value.options.some((option) => option.id === value.correctOptionId))
      ctx.addIssue({ code: 'custom', message: 'Correct option must exist' });
  });
const reorderPayload = z
  .object({ tokens: items, correctOrder: z.array(id).min(2).max(12) })
  .strict()
  .refine(
    (value) =>
      value.correctOrder.length === value.tokens.length &&
      new Set(value.correctOrder).size === value.tokens.length &&
      value.correctOrder.every((token) =>
        value.tokens.some((item) => item.id === token),
      ),
    'Correct order must contain every token ID exactly once',
  );
const matchingPayload = z
  .object({
    left: items,
    right: items,
    correctPairs: z
      .array(z.object({ leftId: id, rightId: id }).strict())
      .min(2)
      .max(12),
  })
  .strict()
  .refine(
    (value) =>
      value.left.length === value.right.length &&
      value.correctPairs.length === value.left.length &&
      new Set(value.correctPairs.map((pair) => pair.leftId)).size ===
        value.left.length &&
      new Set(value.correctPairs.map((pair) => pair.rightId)).size ===
        value.right.length &&
      value.correctPairs.every(
        (pair) =>
          value.left.some((item) => item.id === pair.leftId) &&
          value.right.some((item) => item.id === pair.rightId),
      ),
    'Matching must be a complete bijection',
  );

export const learningActivitySchema = z.discriminatedUnion('type', [
  z
    .object({ ...base, type: z.literal('explanation'), payload: studyPayload })
    .strict(),
  z
    .object({ ...base, type: z.literal('reflection'), payload: studyPayload })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('multiple_choice'),
      payload: multipleChoicePayload,
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('fill_gap'),
      payload: textPayload.extend({ context: text }).strict(),
    })
    .strict(),
  z
    .object({ ...base, type: z.literal('typed_answer'), payload: textPayload })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('sentence_reorder'),
      payload: reorderPayload,
    })
    .strict(),
  z
    .object({ ...base, type: z.literal('matching'), payload: matchingPayload })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('translation'),
      payload: textPayload
        .extend({ sourceText: text, sourceLanguage: z.string().min(2).max(20) })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('error_correction'),
      payload: textPayload.extend({ originalText: text }).strict(),
    })
    .strict(),
]);
export type LearningActivity = z.infer<typeof learningActivitySchema>;
export type ExerciseActivity = Exclude<
  LearningActivity,
  { type: 'explanation' | 'reflection' }
>;
export function isExercise(
  activity: LearningActivity,
): activity is ExerciseActivity {
  return activity.type !== 'explanation' && activity.type !== 'reflection';
}

const publicBase = {
  id: base.id,
  order: base.order,
  instructions: base.instructions,
  prompt: base.prompt,
  skill: base.skill,
  level: base.level,
  tags: base.tags,
};
export const publicExerciseSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...publicBase,
      type: z.literal('multiple_choice'),
      payload: z.object({ options: z.array(item) }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      type: z.literal('fill_gap'),
      payload: z.object({ context: text }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      type: z.literal('typed_answer'),
      payload: z.object({}).strict(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      type: z.literal('sentence_reorder'),
      payload: z.object({ tokens: items }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      type: z.literal('matching'),
      payload: z.object({ left: items, right: items }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      type: z.literal('translation'),
      payload: z
        .object({ sourceText: text, sourceLanguage: z.string() })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      type: z.literal('error_correction'),
      payload: z.object({ originalText: text }).strict(),
    })
    .strict(),
]);
export type PublicExercise = z.infer<typeof publicExerciseSchema>;

/** Explicit allowlist: no expected answers, option feedback or explanation before grading. */
export function presentExercise(activity: ExerciseActivity): PublicExercise {
  const { id, order, instructions, prompt, skill, level, tags, type } =
    activity;
  const common = { id, order, instructions, prompt, skill, level, tags };
  switch (type) {
    case 'multiple_choice': {
      const options = activity.payload.options.map(({ id, text }) => ({
        id,
        text,
      }));
      if (activity.payload.shuffleOptions) {
        const rank = (id: string) =>
          [...`${activity.id}:${id}`].reduce(
            (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
            2166136261,
          );
        options.sort(
          (a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id),
        );
      }
      return { ...common, type, payload: { options } };
    }
    case 'fill_gap':
      return {
        ...common,
        type,
        payload: { context: activity.payload.context },
      };
    case 'typed_answer':
      return { ...common, type, payload: {} };
    case 'sentence_reorder':
      return { ...common, type, payload: { tokens: activity.payload.tokens } };
    case 'matching':
      return {
        ...common,
        type,
        payload: { left: activity.payload.left, right: activity.payload.right },
      };
    case 'translation':
      return {
        ...common,
        type,
        payload: {
          sourceText: activity.payload.sourceText,
          sourceLanguage: activity.payload.sourceLanguage,
        },
      };
    case 'error_correction':
      return {
        ...common,
        type,
        payload: { originalText: activity.payload.originalText },
      };
  }
}
