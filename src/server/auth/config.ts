import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '@/server/db/client';
import * as schema from '@/server/db/schema';
import { allowedGitHubOwner } from './owner-policy';
import { authSetupReady } from '@/lib/auth-env';

const ready = authSetupReady();

export const auth = betterAuth({
  appName: 'Lingua Studio',
  logger: {
    log(level) {
      if (level === 'error') console.error('Authentication request failed.');
    },
  },
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema,
    usePlural: true,
  }),
  advanced: { database: { generateId: 'uuid' } },
  user: {
    validateUserInfo: ({ user, source }) => {
      if (
        !allowedGitHubOwner(
          source.oauth?.providerId,
          source.oauth?.profile?.id,
          user.emailVerified,
          process.env.GITHUB_OWNER_ID,
        )
      ) {
        return {
          error: 'owner_only',
          errorDescription: 'Access is restricted.',
        };
      }
    },
  },
  emailAndPassword: { enabled: false },
  socialProviders: ready
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          scope: ['user:email'],
        },
      }
    : {},
});
