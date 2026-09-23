import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => /^postgres(ql)?:/.test(v), 'Use a PostgreSQL connection URL')
    .optional(),
});
export function readEnv(
  input: Record<string, string | undefined> = process.env,
) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      'Invalid DATABASE_URL. Expected a PostgreSQL connection URL.',
    );
  return result.data;
}
export function requireDatabaseUrl() {
  const url = readEnv().DATABASE_URL;
  if (!url)
    throw new Error(
      'DATABASE_URL is required for database operations. See .env.example.',
    );
  return url;
}
