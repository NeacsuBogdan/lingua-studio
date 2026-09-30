import { getOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import {
  submitMistakePractice,
  MistakeError,
} from '@/server/mistakes/repository';
import { AnswerError } from '@/server/exercises/evaluate';

export async function POST(request: Request) {
  const owner = await getOwner();
  if (!owner)
    return Response.json(
      { error: 'Sign in before answering.' },
      { status: 401 },
    );
  const origin = request.headers.get('origin');
  if (
    !process.env.BETTER_AUTH_URL ||
    origin !== new URL(process.env.BETTER_AUTH_URL).origin
  )
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 16000)
      return Response.json({ error: 'Answer is too large.' }, { status: 400 });
    const raw: unknown = JSON.parse(text);
    const profile = await getOrCreateProfile(owner.id);
    const result = await submitMistakePractice(
      getDb(),
      owner.id,
      profile.learningLanguage,
      raw,
      new Date(),
    );
    return Response.json(
      { result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error instanceof AnswerError ||
      (error instanceof MistakeError && error.code === 'invalid')
    )
      return Response.json(
        { error: 'Check the answer format and try again.' },
        { status: 400 },
      );
    if (error instanceof MistakeError)
      return Response.json(
        {
          error:
            'This activity is no longer available. Return to Mistake Center.',
        },
        { status: 409 },
      );
    return Response.json(
      { error: 'Your answer could not be saved. Please try again.' },
      { status: 503 },
    );
  }
}
