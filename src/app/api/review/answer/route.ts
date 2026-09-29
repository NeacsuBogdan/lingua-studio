import { z } from 'zod';
import { getOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { getReviewAnswer, ReviewError } from '@/server/review/repository';

const querySchema = z
  .object({ sessionId: z.uuid(), itemId: z.uuid() })
  .strict();
export async function GET(request: Request) {
  const owner = await getOwner();
  if (!owner)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success)
    return Response.json({ error: 'Invalid review.' }, { status: 400 });
  try {
    const profile = await getOrCreateProfile(owner.id);
    const answer = await getReviewAnswer(
      getDb(),
      owner.id,
      profile.learningLanguage,
      parsed.data.sessionId,
      parsed.data.itemId,
      new Date(),
    );
    return Response.json(answer, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ReviewError)
      return Response.json({ error: 'Review unavailable.' }, { status: 404 });
    return Response.json({ error: 'Could not load answer.' }, { status: 503 });
  }
}
