import { afterEach, expect, it, vi } from 'vitest';

const handler = vi.hoisted(() => vi.fn());
vi.mock('@/server/auth/config', () => ({ auth: { handler } }));
import { POST } from '../src/app/api/auth/[...all]/route';

afterEach(() => vi.restoreAllMocks());

it('returns a generic response and log when the auth adapter throws sensitive context', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  handler.mockRejectedValueOnce(
    new Error('OAuth state and PKCE verifier must stay private'),
  );
  const response = await POST(
    new Request('http://127.0.0.1:3000/api/auth/sign-in/social', {
      method: 'POST',
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: 'Authentication service temporarily unavailable.',
  });
  expect(log).toHaveBeenCalledWith('Authentication request failed.');
  expect(JSON.stringify(log.mock.calls)).not.toContain('PKCE');
});
