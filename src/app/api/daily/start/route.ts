import { getOwner } from '@/server/auth/session';
import { getOrCreateProfile } from '@/server/profile/repository';
import { getDb } from '@/server/db/client';
import { DailyError, startDailySession } from '@/server/daily/repository';
import { dailyStartSchema } from '@/lib/daily-request';

export async function POST(request: Request) {
  const owner = await getOwner();
  if (!owner)
    return Response.json(
      { error: 'Sign in before starting.' },
      { status: 401 },
    );
  if (
    !process.env.BETTER_AUTH_URL ||
    request.headers.get('origin') !==
      new URL(process.env.BETTER_AUTH_URL).origin
  )
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const text = await request.text();
    if (
      text.length > 100 ||
      !dailyStartSchema.safeParse(JSON.parse(text)).success
    )
      return Response.json(
        { error: 'Start accepts no plan fields.' },
        { status: 400 },
      );
    await getOrCreateProfile(owner.id);
    const sessionId = await startDailySession(getDb(), owner.id, new Date());
    return Response.json(
      { sessionId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    if (error instanceof DailyError)
      return Response.json(
        { error: 'No work is available. Refresh Today.' },
        { status: 409 },
      );
    return Response.json(
      { error: 'Your plan could not be saved. Please try again.' },
      { status: 503 },
    );
  }
}
