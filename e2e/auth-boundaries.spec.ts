import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('protected pages redirect visitors to sign-in', async ({ page }) => {
  for (const route of ['/', '/course', '/settings']) {
    await page.goto(route);
    await expect(page).toHaveURL('/sign-in');
    await expect(
      page.getByRole('heading', { name: 'Your learning space.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Your English learning path.' }),
    ).toHaveCount(0);
  }
});

test('session endpoint does not create a session for a visitor', async ({
  request,
}) => {
  const response = await request.get('/api/auth/get-session');
  expect(response.status()).toBe(200);
  expect(await response.json()).toBeNull();
});

test('a forged session cookie cannot open the app', async ({ page }) => {
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'forged-session-token',
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  await page.goto('/settings');
  await expect(page).toHaveURL('/sign-in');
});

for (const theme of ['light', 'dark'] as const) {
  test(`public sign-in supports ${theme} system theme, keyboard and reflow`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/sign-in');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to content' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
