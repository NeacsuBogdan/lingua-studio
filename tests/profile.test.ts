import { describe, it, expect } from 'vitest';
import { profileInputSchema } from '../src/lib/profile-schema';
import { allowedGitHubOwner } from '../src/server/auth/owner-policy';
import { authSetupReady } from '../src/lib/auth-env';

const valid = {
  nativeLanguage: 'ro',
  learningLanguage: 'en',
  targetLevel: 'C1',
  targetExam: 'c1-advanced',
  dailyMinutes: '20',
  timezone: 'Europe/Bucharest',
};

describe('learner profile boundary', () => {
  it('accepts every persisted preference with a real time zone', () => {
    expect(profileInputSchema.parse(valid)).toMatchObject({
      ...valid,
      dailyMinutes: 20,
    });
  });
  it('rejects unsupported duration, exam and time zone', () => {
    expect(
      profileInputSchema.safeParse({ ...valid, dailyMinutes: '13' }).success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({ ...valid, targetExam: 'official-pass' })
        .success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({ ...valid, timezone: 'Not/A_Zone' })
        .success,
    ).toBe(false);
  });
  it('requires two distinct supported languages', () => {
    expect(
      profileInputSchema.safeParse({ ...valid, learningLanguage: 'ro' })
        .success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({ ...valid, nativeLanguage: 'xx' }).success,
    ).toBe(false);
  });
  it('does not attach a Cambridge exam to another learning language', () => {
    expect(
      profileInputSchema.safeParse({ ...valid, learningLanguage: 'ja' })
        .success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({
        ...valid,
        learningLanguage: 'ja',
        targetExam: null,
      }).success,
    ).toBe(true);
  });
});

describe('owner-only OAuth gate', () => {
  it('accepts only the matching stable verified GitHub identity', () => {
    expect(allowedGitHubOwner('github', 12345, true, '12345')).toBe(true);
    expect(allowedGitHubOwner('github', '12345', true, '12345')).toBe(true);
    expect(allowedGitHubOwner('github', 12345, true, undefined)).toBe(false);
    expect(allowedGitHubOwner('github', 12346, true, '12345')).toBe(false);
    expect(allowedGitHubOwner('google', 12345, true, '12345')).toBe(false);
    expect(allowedGitHubOwner('github', 12345, false, '12345')).toBe(false);
    expect(allowedGitHubOwner('github', '012345', true, '12345')).toBe(false);
  });
});

describe('authentication environment', () => {
  const configured = {
    BETTER_AUTH_URL: 'http://127.0.0.1:3000',
    BETTER_AUTH_SECRET: 'x'.repeat(48),
    GITHUB_CLIENT_ID: 'test-client',
    GITHUB_CLIENT_SECRET: 'test-secret',
    GITHUB_OWNER_ID: '12345',
  };

  it('requires the full owner configuration', () => {
    expect(authSetupReady(configured)).toBe(true);
    expect(authSetupReady({ ...configured, GITHUB_OWNER_ID: undefined })).toBe(
      false,
    );
    expect(authSetupReady({ ...configured, BETTER_AUTH_SECRET: 'short' })).toBe(
      false,
    );
  });

  it('allows HTTPS or local HTTP only', () => {
    expect(
      authSetupReady({ ...configured, BETTER_AUTH_URL: 'https://example.com' }),
    ).toBe(true);
    expect(
      authSetupReady({ ...configured, BETTER_AUTH_URL: 'http://example.com' }),
    ).toBe(false);
  });
});
