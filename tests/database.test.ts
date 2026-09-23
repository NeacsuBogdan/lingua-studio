import { afterAll, beforeAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import {
  users,
  languages,
  learnerProfiles,
  accounts,
  sessions,
  verifications,
} from '../src/server/db/schema';
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
it('persists a provider account and session, then cascades logout state with user deletion', async () => {
  const [user] = await db
    .insert(users)
    .values({ email: 'auth@example.test', name: 'Learner' })
    .returning();
  await db.insert(accounts).values({
    userId: user.id,
    providerId: 'github',
    accountId: '12345',
  });
  await expect(
    db.insert(accounts).values({
      userId: user.id,
      providerId: 'github',
      accountId: '12345',
    }),
  ).rejects.toThrow();
  await db.insert(sessions).values({
    userId: user.id,
    token: 'opaque-session-token',
    expiresAt: new Date(Date.now() + 60_000),
  });
  expect(
    await db.select().from(sessions).where(eq(sessions.userId, user.id)),
  ).toHaveLength(1);
  await db.delete(users).where(eq(users.id, user.id));
  expect(
    await db.select().from(sessions).where(eq(sessions.userId, user.id)),
  ).toHaveLength(0);
  expect(
    await db.select().from(accounts).where(eq(accounts.userId, user.id)),
  ).toHaveLength(0);
});
it('generates database IDs for OAuth verification, account and session rows', async () => {
  const [verification] = await db
    .insert(verifications)
    .values({
      identifier: 'oauth-state-test',
      value: '{}',
      expiresAt: new Date(Date.now() + 60_000),
    })
    .returning();
  expect(verification.id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
});
it('persists learner preference edits and keeps them isolated by user', async () => {
  const [first] = await db
    .insert(users)
    .values({ email: 'profile-first@example.test' })
    .returning();
  const [second] = await db
    .insert(users)
    .values({ email: 'profile-second@example.test' })
    .returning();
  await db.insert(learnerProfiles).values([
    { userId: first.id, nativeLanguage: 'ro', learningLanguage: 'en' },
    { userId: second.id, nativeLanguage: 'ro', learningLanguage: 'en' },
  ]);
  await db
    .update(learnerProfiles)
    .set({
      targetLevel: 'C2',
      targetExam: 'c2-proficiency',
      dailyMinutes: 45,
      timezone: 'Europe/London',
    })
    .where(eq(learnerProfiles.userId, first.id));
  const [saved] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, first.id));
  const [untouched] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, second.id));
  expect(saved).toMatchObject({
    targetLevel: 'C2',
    targetExam: 'c2-proficiency',
    dailyMinutes: 45,
    timezone: 'Europe/London',
  });
  expect(untouched).toMatchObject({
    targetLevel: 'C1',
    targetExam: null,
    dailyMinutes: 20,
  });
});
