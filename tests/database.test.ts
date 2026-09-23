import { afterAll, beforeAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { users, languages, learnerProfiles } from '../src/server/db/schema';
import { eq } from 'drizzle-orm';
const client = new PGlite();
const db = drizzle(client);
beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(languages).values([
    { code: 'en', name: 'English' },
    { code: 'ro', name: 'Romanian' },
  ]);
}, 30000);
afterAll(async () => {
  await client.close();
});
it('applies migrations twice safely', async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  expect(await db.select().from(languages)).toHaveLength(2);
});
it('round-trips a learner and cascades profile deletion', async () => {
  const [user] = await db
    .insert(users)
    .values({ email: 'learner@example.test' })
    .returning();
  await db
    .insert(learnerProfiles)
    .values({ userId: user.id, nativeLanguage: 'ro', learningLanguage: 'en' });
  const [profile] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, user.id));
  expect(profile.dailyMinutes).toBe(20);
  expect(profile.targetLevel).toBe('C1');
  await db.delete(users).where(eq(users.id, user.id));
  expect(await db.select().from(learnerProfiles)).toHaveLength(0);
});
it('enforces case-insensitive identity uniqueness', async () => {
  await db.insert(users).values({ email: 'unique@example.test' });
  await expect(
    db.insert(users).values({ email: 'UNIQUE@example.test' }),
  ).rejects.toThrow();
});
it('rejects invalid durations and missing language references', async () => {
  const [user] = await db
    .insert(users)
    .values({ email: 'constraint@example.test' })
    .returning();
  await expect(
    db.insert(learnerProfiles).values({
      userId: user.id,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
      dailyMinutes: -1,
    }),
  ).rejects.toThrow();
  await expect(
    db.insert(learnerProfiles).values({
      userId: user.id,
      nativeLanguage: 'xx',
      learningLanguage: 'en',
    }),
  ).rejects.toThrow();
});
