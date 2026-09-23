import { z } from 'zod';

export const profileInputSchema = z
  .object({
    nativeLanguage: z.enum(['en', 'ro', 'ja', 'es', 'it']),
    learningLanguage: z.enum(['en', 'ro', 'ja', 'es', 'it']),
    targetLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    targetExam: z
      .enum(['b2-first', 'c1-advanced', 'c2-proficiency'])
      .nullable(),
    dailyMinutes: z.coerce
      .number()
      .pipe(
        z.union([
          z.literal(5),
          z.literal(10),
          z.literal(20),
          z.literal(30),
          z.literal(45),
          z.literal(60),
        ]),
      ),
    timezone: z
      .string()
      .min(1)
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Choose a valid IANA time zone'),
  })
  .refine((value) => value.nativeLanguage !== value.learningLanguage, {
    message: 'Choose different native and learning languages',
    path: ['learningLanguage'],
  })
  .refine(
    (value) => value.learningLanguage === 'en' || value.targetExam === null,
    {
      message: 'Cambridge exams are available for English only',
      path: ['targetExam'],
    },
  );

export type ProfileInput = z.infer<typeof profileInputSchema>;
