'use server';
import { revalidatePath } from 'next/cache';
import { profileInputSchema } from '@/lib/profile-schema';
import { getOwner } from '@/server/auth/session';
import { updateProfile } from '@/server/profile/repository';

export type SaveProfileState = {
  status: 'idle' | 'saved' | 'invalid' | 'unauthorized';
  message: string;
};

export async function saveProfile(data: FormData): Promise<SaveProfileState> {
  const owner = await getOwner();
  if (!owner) {
    return {
      status: 'unauthorized',
      message: 'Your session ended. Sign in again.',
    };
  }
  const result = profileInputSchema.safeParse({
    nativeLanguage: data.get('nativeLanguage'),
    learningLanguage: data.get('learningLanguage'),
    targetLevel: data.get('targetLevel'),
    targetExam: data.get('targetExam') || null,
    dailyMinutes: data.get('dailyMinutes'),
    timezone: data.get('timezone'),
  });
  if (!result.success) {
    return {
      status: 'invalid',
      message: result.error.issues[0]?.message ?? 'Check your settings.',
    };
  }
  await updateProfile(owner.id, result.data);
  revalidatePath('/settings');
  revalidatePath('/');
  return { status: 'saved', message: 'Your learning profile was saved.' };
}
