import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from '../src/server/db/schema';

const client = new PGlite();
const db = drizzle(client, { schema });
const secret = 'integration-test-secret-at-least-32-characters';
const auth = betterAuth({
  baseURL: 'http://localhost:3000',
  secret,
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  advanced: { database: { generateId: 'uuid' } },
  emailAndPassword: { enabled: false },
});
let userId: string;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  const [user] = await db
    .insert(schema.users)
    .values({
      email: 'session@example.test',
      name: 'Session test',
      emailVerified: true,
    })
    .returning();
  userId = user.id;
}, 30_000);

afterAll(async () => {
  await client.close();
});

function signedHeaders(token: string) {
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  const cookie = encodeURIComponent(`${token}.${signature}`);
  return new Headers({ cookie: `better-auth.session_token=${cookie}` });
}

it('returns a persisted active session and rejects the same signed cookie after expiry', async () => {
  const token = 'integration-session-token';
  const [session] = await db
    .insert(schema.sessions)
    .values({ userId, token, expiresAt: new Date(Date.now() + 60 * 60_000) })
    .returning();

  const active = await auth.api.getSession({ headers: signedHeaders(token) });
  expect(active?.user.id).toBe(userId);

  await db
    .update(schema.sessions)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(schema.sessions.id, session.id));
  expect(
    await auth.api.getSession({ headers: signedHeaders(token) }),
  ).toBeNull();
});
