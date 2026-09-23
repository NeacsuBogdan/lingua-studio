import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from './config';
import { getDb } from '@/server/db/client';
import { accounts } from '@/server/db/schema';
import { authSetupReady } from '@/lib/auth-env';

export async function getOwner() {
  const requestHeaders = await headers();
  const ownerId = process.env.GITHUB_OWNER_ID;
  if (!ownerId || !authSetupReady()) return null;
  const current = await auth.api.getSession({ headers: requestHeaders });
  if (!current || !current.user.emailVerified) return null;
  const [account] = await getDb()
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, current.user.id),
        eq(accounts.providerId, 'github'),
        eq(accounts.accountId, ownerId),
      ),
    )
    .limit(1);
  return account ? current.user : null;
}

export async function requireOwner() {
  const user = await getOwner();
  if (!user) redirect('/sign-in');
  return user;
}
