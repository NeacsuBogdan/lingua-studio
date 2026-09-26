import { z } from 'zod';
const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const text = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => value.trim().length > 0, 'Answer cannot be blank');
export const exerciseAnswerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('multiple_choice'), optionId: id }).strict(),
  z.object({ type: z.literal('fill_gap'), text }).strict(),
  z.object({ type: z.literal('typed_answer'), text }).strict(),
  z.object({ type: z.literal('translation'), text }).strict(),
  z.object({ type: z.literal('error_correction'), text }).strict(),
  z
    .object({
      type: z.literal('sentence_reorder'),
      tokenIds: z.array(id).min(2).max(12),
    })
    .strict(),
  z
    .object({
      type: z.literal('matching'),
      pairs: z
        .array(z.object({ leftId: id, rightId: id }).strict())
        .min(2)
        .max(12),
    })
    .strict(),
]);
export const attemptRequestSchema = z
  .object({
    submissionId: z.uuid(),
    lessonId: id,
    activityId: id,
    contentVersion: z.number().int().positive(),
    answer: exerciseAnswerSchema,
  })
  .strict();
export type ExerciseAnswer = z.infer<typeof exerciseAnswerSchema>;
export type AttemptRequest = z.infer<typeof attemptRequestSchema>;
export const gradingResultSchema = z
  .object({
    isCorrect: z.boolean(),
    score: z.number().min(0).max(1),
    expectedAnswer: z.string(),
    explanation: z.string(),
    feedback: z.string(),
  })
  .strict();
export const savedResultSchema = gradingResultSchema
  .extend({ attemptId: z.uuid() })
  .strict();
export type GradingResult = z.infer<typeof gradingResultSchema>;
export type SavedResult = z.infer<typeof savedResultSchema>;
