'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import {
  finishReviewSession,
  skipStaleReviewItem,
  startReviewSession,
} from '@/server/review/repository';

const id = z.uuid();
export async function startReviewAction() {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const sessionId = await startReviewSession(
    getDb(),
    owner.id,
    profile.learningLanguage,
    new Date(),
  );
  if (sessionId) redirect(`/review/session/${sessionId}`);
  revalidatePath('/review');
}
export async function finishReviewAction(sessionId: string) {
  const owner = await requireOwner();
  await finishReviewSession(getDb(), owner.id, id.parse(sessionId), new Date());
  revalidatePath(`/review/session/${sessionId}`);
  revalidatePath('/review');
}
export async function skipStaleReviewAction(sessionId: string, itemId: string) {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  await skipStaleReviewItem(
    getDb(),
    owner.id,
    profile.learningLanguage,
    id.parse(sessionId),
    id.parse(itemId),
    new Date(),
  );
  revalidatePath(`/review/session/${sessionId}`);
}
