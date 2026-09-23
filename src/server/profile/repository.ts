import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { learnerProfiles } from '@/server/db/schema';
import type { ProfileInput } from '@/lib/profile-schema';

export async function getOrCreateProfile(userId: string) {
  const db = getDb();
  await db
    .insert(learnerProfiles)
    .values({
      userId,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
    })
    .onConflictDoNothing();
  const [profile] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, userId))
    .limit(1);
  if (!profile) throw new Error('Learner profile unavailable');
  return profile;
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const db = getDb();
  await db
    .insert(learnerProfiles)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: learnerProfiles.userId,
      set: { ...input, updatedAt: new Date() },
    });
}
