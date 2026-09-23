export function databaseTlsOptions(url: string) {
  const host = new URL(url).hostname;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
  return local ? {} : { ssl: 'verify-full' as const };
}
