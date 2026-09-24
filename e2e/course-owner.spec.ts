import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { databaseTlsOptions } from '../src/lib/database-tls';
import * as schema from '../src/server/db/schema';

const enabled = process.env.E2E_OWNER_COURSE === '1';
const fixtureOwnerId = '987654321012345678';
let sql: ReturnType<typeof postgres> | undefined;
let userId: string | undefined;
let token: string;
let secret: string;

test.skip(
  !enabled,
  'Set E2E_OWNER_COURSE=1 to run the isolated owner-session fixture.',
);
test.skip(
  ({ isMobile }) => isMobile,
  'The learning flow checks desktop and mobile sizes in one isolated session.',
);

test.beforeAll(async () => {
  try {
    nextEnv.loadEnvConfig(process.cwd());
    const url = process.env.DATABASE_URL;
    secret = process.env.BETTER_AUTH_SECRET ?? '';
    if (!url || secret.length < 32)
      throw new Error('Missing fixture configuration');
    sql = postgres(url, { max: 1, prepare: false, ...databaseTlsOptions(url) });
    const db = drizzle(sql, { schema });
    const [user] = await db
      .insert(schema.users)
      .values({
        email: `phase3-e2e-${randomUUID()}@example.test`,
        name: 'Course E2E learner',
        emailVerified: true,
      })
      .returning();
    userId = user.id;
    await db.insert(schema.accounts).values({
      userId,
      providerId: 'github',
      accountId: fixtureOwnerId,
    });
    await db.insert(schema.learnerProfiles).values({
      userId,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
    });
    token = randomBytes(32).toString('hex');
    await db.insert(schema.sessions).values({
      userId,
      token,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
  } catch {
    throw new Error('Course E2E fixture setup failed.');
  }
});

test.afterAll(async () => {
  if (!sql) return;
  try {
    if (userId)
      await drizzle(sql, { schema })
        .delete(schema.users)
        .where(eq(schema.users.id, userId));
  } finally {
    await sql.end();
  }
});

test('owner completes the first lesson and unlocks the second across reloads', async ({
  page,
  browser,
}, testInfo) => {
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: encodeURIComponent(`${token}.${signature}`),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/course');
  await expect(
    page.getByRole('heading', { name: 'Your English learning path.' }),
  ).toBeVisible();
  await expect(page.getByText('0 / 5')).toBeVisible();
  await expect(
    page.getByText('Locked · complete earlier lessons').first(),
  ).toBeVisible();
  await page.goto('/course/lesson/en-b1-narrative');
  await expect(
    page.getByRole('heading', { name: 'This lesson is locked.' }),
  ).toBeVisible();
  await page.goto('/course/lesson/en-b1-present-perfect');
  await expect(
    page.getByRole('heading', { name: 'The past that matters now' }),
  ).toBeVisible();
  const startForm = await page
    .locator('form')
    .first()
    .evaluate((form) => form.outerHTML);
  const anonymousContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
  });
  try {
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto('/sign-in');
    await anonymousPage.evaluate((markup) => {
      const container = document.createElement('div');
      container.innerHTML = markup;
      const form = container.querySelector('form');
      if (!form) throw new Error('Start form unavailable');
      form.action = '/course/lesson/en-b1-present-perfect';
      document.body.append(form);
    }, startForm);
    await anonymousPage
      .locator('form')
      .last()
      .getByRole('button', { name: 'Begin lesson' })
      .click();
    await expect(anonymousPage).toHaveURL('/sign-in');
  } finally {
    await anonymousContext.close();
  }
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Begin lesson' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Begin lesson' }).click();
  await expect(page.getByText('BLOCK 1 OF 2')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('lesson-desktop-light.png'),
  });
  const lessonAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    lessonAccessibility.violations.map((violation) => violation.id),
  ).toEqual([]);
  await page.reload();
  await expect(page.getByText('BLOCK 1 OF 2')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('BLOCK 2 OF 2')).toBeVisible();
  await page.getByRole('button', { name: 'Complete lesson' }).click();
  await expect(
    page.getByRole('heading', { name: 'Lesson completed.' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Lesson completed.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Return to learning path' }).click();
  await expect(page.getByText('1 / 5')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open A story with a clear sequence' }),
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('course-desktop-light.png'),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: testInfo.outputPath('course-desktop-dark.png'),
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.reload();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`course-${width}-dark.png`),
      fullPage: true,
    });
  }
  await page.screenshot({
    path: testInfo.outputPath('course-320-viewport-dark.png'),
  });
  await page.goto('/course/lesson/en-b1-narrative');
  await expect(
    page.getByRole('button', { name: 'Begin lesson' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('lesson-320-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: testInfo.outputPath('lesson-320-light.png') });
  const mobileAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    mobileAccessibility.violations.map((violation) => violation.id),
  ).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});
