export function allowedGitHubOwner(
  providerId: string | undefined,
  profileId: unknown,
  verifiedEmail: unknown,
  ownerId: string | undefined,
) {
  const providerAccountId =
    typeof profileId === 'number' && Number.isSafeInteger(profileId)
      ? String(profileId)
      : typeof profileId === 'string' && /^[1-9]\d*$/.test(profileId)
        ? profileId
        : null;
  return (
    providerId === 'github' &&
    providerAccountId !== null &&
    providerAccountId === ownerId &&
    verifiedEmail === true
  );
}
