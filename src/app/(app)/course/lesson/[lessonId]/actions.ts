'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import {
  getLessonView,
  startLesson,
  advanceLesson,
  CourseError,
} from '@/server/course/repository';

const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const positionSchema = z.number().int().nonnegative();

async function authorizeLesson(lessonId: string) {
  const owner = await requireOwner();
  const profile = await getOrCreateProfile(owner.id);
  const db = getDb();
  try {
    const view = await getLessonView(
      db,
      owner.id,
      profile.learningLanguage,
      lessonId,
    );
    if (view.lesson.state === 'locked') redirect('/course');
  } catch (error) {
    if (error instanceof CourseError && error.code === 'not_found')
      redirect('/course');
    throw error;
  }
  return { db, userId: owner.id };
}

export async function startLessonAction(lessonId: string, data: FormData) {
  void data;
  const id = idSchema.parse(lessonId);
  const { db, userId } = await authorizeLesson(id);
  await startLesson(db, userId, id);
  revalidatePath('/course');
  revalidatePath(`/course/lesson/${id}`);
  redirect(`/course/lesson/${id}`);
}

export async function advanceLessonAction(
  lessonId: string,
  expectedPosition: number,
  contentVersion: number,
  data: FormData,
) {
  void data;
  const id = idSchema.parse(lessonId);
  const position = positionSchema.parse(expectedPosition);
  const { db, userId } = await authorizeLesson(id);
  try {
    await advanceLesson(
      db,
      userId,
      id,
      position,
      z.number().int().positive().parse(contentVersion),
    );
  } catch (error) {
    if (!(error instanceof CourseError && error.code === 'stale')) throw error;
  }
  revalidatePath('/course');
  revalidatePath(`/course/lesson/${id}`);
  redirect(`/course/lesson/${id}`);
}
