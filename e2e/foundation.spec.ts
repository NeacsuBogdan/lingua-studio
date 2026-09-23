import { test, expect } from '@playwright/test';
test('navigate the honest foundation and retain appearance', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Make room for English.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Explore your learning path' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your English learning path.' }),
  ).toBeVisible();
  await expect(page.getByText('Content in preparation')).toHaveCount(6);
  await page.getByRole('link', { name: 'Preferences', exact: true }).click();
  const toggle = page
    .locator('main')
    .getByRole('button', { name: 'Toggle color theme' });
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    /light|dark/,
  );
  const before = await page.locator('html').getAttribute('data-theme');
  await toggle.click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto('/');
  await expect(page.getByText('No sessions yet')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/overview-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('unknown routes offer a way back', async ({ page }) => {
  await page.goto('/missing-page');
  await expect(
    page.getByRole('heading', { name: 'This page isn’t on the path.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page).toHaveURL('/');
});
