import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const theme of ['light', 'dark'] as const) {
  test(`system ${theme} appearance, keyboard access and responsive pages`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to content' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await page.keyboard.press('Tab');
    const toggle = page
      .locator('main')
      .getByRole('button', { name: 'Toggle color theme' });
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    const selectedTheme = theme === 'light' ? 'dark' : 'light';
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      selectedTheme,
    );
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      selectedTheme,
    );
    await toggle.click();
    for (const route of ['/', '/course', '/settings']) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `${route.replaceAll('/', '') || 'overview'}-${theme}.png`,
        ),
        fullPage: true,
      });
      // 320 CSS pixels also exercises reflow equivalent to 400% zoom at 1280px.
      const originalViewport = page.viewportSize()!;
      await page.setViewportSize({ width: 320, height: 800 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `${route.replaceAll('/', '') || 'overview'}-${theme}-320.png`,
        ),
        fullPage: true,
      });
      await page.setViewportSize(originalViewport);
    }
    expect(errors).toEqual([]);
  });
}

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
