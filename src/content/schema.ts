import { z } from 'zod';
export const cefrSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const base = {
  id: z.string().min(1),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  tags: z.array(z.string()),
};
export const activitySchema = z.discriminatedUnion('type', [
  z
    .object({
      ...base,
      type: z.literal('multiple-choice'),
      options: z.array(z.string().min(1)).min(2),
      answerIndex: z.number().int().nonnegative(),
    })
    .refine(
      (a) => a.answerIndex < a.options.length,
      'Answer index must reference an option',
    ),
  z.object({
    ...base,
    type: z.literal('typed-answer'),
    acceptedAnswers: z.array(z.string().min(1)).min(1),
    caseSensitive: z.boolean().default(false),
  }),
]);
export const lessonSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    language: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
    level: cefrSchema,
    title: z.string().min(1),
    prerequisiteIds: z.array(z.string()),
    activities: z.array(activitySchema).min(1),
  })
  .superRefine((lesson, ctx) => {
    if (
      new Set(lesson.activities.map((a) => a.id)).size !==
      lesson.activities.length
    )
      ctx.addIssue({ code: 'custom', message: 'Activity IDs must be unique' });
    if (lesson.prerequisiteIds.includes(lesson.id))
      ctx.addIssue({
        code: 'custom',
        message: 'A lesson cannot require itself',
      });
  });
export type Lesson = z.infer<typeof lessonSchema>;
