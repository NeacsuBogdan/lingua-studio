import { describe, it, expect } from 'vitest';
import { lessonSchema } from '../src/content/schema';
import lesson from '../src/content/en/example.json';
import { readEnv } from '../src/lib/env';
describe('Content boundary', () => {
  it('accepts the bilingual-ready starter lesson', () => {
    expect(lessonSchema.parse(lesson).activities).toHaveLength(2);
  });
  it('rejects a nonexistent correct option', () => {
    const invalid = structuredClone(lesson);
    invalid.activities[0].answerIndex = 30;
    expect(lessonSchema.safeParse(invalid).success).toBe(false);
  });
  it('rejects duplicate activity identities', () => {
    expect(
      lessonSchema.safeParse({
        ...lesson,
        activities: [lesson.activities[0], lesson.activities[0]],
      }).success,
    ).toBe(false);
  });
  it('rejects self prerequisites', () => {
    expect(
      lessonSchema.safeParse({ ...lesson, prerequisiteIds: [lesson.id] })
        .success,
    ).toBe(false);
  });
});
describe('Environment boundary', () => {
  it('allows the foundation UI without a database', () => {
    expect(readEnv({})).toEqual({});
  });
  it('rejects invalid protocols without exposing the supplied secret', () => {
    expect(() =>
      readEnv({ DATABASE_URL: 'https://private-password.example' }),
    ).toThrow('Invalid DATABASE_URL. Expected a PostgreSQL connection URL.');
  });
  it('accepts PostgreSQL URLs', () => {
    expect(
      readEnv({ DATABASE_URL: 'postgresql://user:pass@localhost/db' })
        .DATABASE_URL,
    ).toBeDefined();
  });
});
