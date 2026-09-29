import { z } from 'zod';
import { getOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { ReviewError, submitReview } from '@/server/review/repository';
import { reviewRatings } from '@/server/review/scheduler';

const requestSchema = z
  .object({
    sessionId: z.uuid(),
    itemId: z.uuid(),
    cardId: z.uuid(),
    submissionId: z.uuid(),
    rating: z.enum(reviewRatings),
  })
  .strict();
export async function POST(request: Request) {
  const owner = await getOwner();
  if (!owner)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (
    !process.env.BETTER_AUTH_URL ||
    request.headers.get('origin') !==
      new URL(process.env.BETTER_AUTH_URL).origin
  )
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 2000)
      return Response.json({ error: 'Request too large.' }, { status: 400 });
    const parsed = requestSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return Response.json({ error: 'Invalid review.' }, { status: 400 });
    const profile = await getOrCreateProfile(owner.id);
    const result = await submitReview(
      getDb(),
      owner.id,
      profile.learningLanguage,
      parsed.data,
      new Date(),
    );
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof ReviewError && error.code === 'invalid')
    )
      return Response.json({ error: 'Invalid review.' }, { status: 400 });
    if (error instanceof ReviewError)
      return Response.json(
        { error: 'Review changed. Refresh and try again.' },
        { status: 409 },
      );
    return Response.json(
      { error: 'Review could not be saved.' },
      { status: 503 },
    );
  }
}
