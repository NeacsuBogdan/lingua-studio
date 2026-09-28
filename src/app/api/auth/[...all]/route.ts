import { auth } from '@/server/auth/config';

// A failed adapter/network call can throw an error containing OAuth state or
// PKCE parameters. Do not let Next.js serialize/log that exception verbatim.
async function handle(request: Request): Promise<Response> {
  try {
    return await auth.handler(request);
  } catch {
    console.error('Authentication request failed.');
    return Response.json(
      { error: 'Authentication service temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export { handle as GET, handle as POST };
