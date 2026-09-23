export function authSetupReady(
  env: Record<string, string | undefined> = process.env,
) {
  const url = env.BETTER_AUTH_URL;
  let safeUrl = false;
  if (url) {
    try {
      const parsed = new URL(url);
      safeUrl =
        parsed.protocol === 'https:' ||
        (parsed.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(parsed.hostname));
    } catch {
      safeUrl = false;
    }
  }
  return Boolean(
    safeUrl &&
    env.BETTER_AUTH_SECRET &&
    env.BETTER_AUTH_SECRET.length >= 32 &&
    env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_SECRET &&
    env.GITHUB_OWNER_ID &&
    /^[1-9]\d*$/.test(env.GITHUB_OWNER_ID),
  );
}
