'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { setSavedVocabulary } from '@/server/vocabulary/repository';

const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
export async function setSavedAction(
  id: string,
  save: boolean,
  data: FormData,
) {
  void data;
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const senseId = idSchema.parse(id);
  const desired = z.boolean().parse(save);
  if (
    !(await setSavedVocabulary(
      getDb(),
      owner.id,
      profile.learningLanguage,
      senseId,
      desired,
    ))
  )
    throw new Error('Vocabulary item unavailable.');
  revalidatePath('/vocabulary');
  revalidatePath(`/vocabulary/${senseId}`);
}
