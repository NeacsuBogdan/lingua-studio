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
        email: `phase4-e2e-${randomUUID()}@example.test`,
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

test('owner practises all seven exercise types and retains progress securely', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: encodeURIComponent(token + '.' + signature),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.name));
  const payload = {
    submissionId: randomUUID(),
    lessonId: 'en-b1-present-perfect',
    activityId: 'en-b1-present-perfect-choice',
    contentVersion: 2,
    answer: { type: 'multiple_choice', optionId: 'sent' },
  };
  expect(
    (await request.post('/api/exercises/attempt', { data: payload })).status(),
  ).toBe(401);
  await page.goto('/course/lesson/en-b1-narrative');
  await expect(
    page.getByRole('heading', { name: 'This lesson is locked.' }),
  ).toBeVisible();
  const api = page.context().request;
  const headers = { Origin: 'http://127.0.0.1:3100' };
  expect(
    (
      await api.post('/api/exercises/attempt', {
        headers,
        data: {
          ...payload,
          lessonId: 'en-b1-narrative',
          activityId: 'en-b1-narrative-reorder',
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await api.post('/api/exercises/attempt', {
        headers,
        data: { ...payload, userId: randomUUID() },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await api.post('/api/exercises/attempt', { headers, data: payload })
    ).status(),
  ).toBe(409);

  await page.goto('/course/lesson/en-b1-present-perfect');
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
      const form = container.querySelector('form')!;
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

  async function inspectExercise(name: string) {
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (width === 320 || (width === 1280 && theme === 'light'))
          await page.screenshot({
            path: testInfo.outputPath(
              name + '-' + width + '-' + theme + '.png',
            ),
            fullPage: true,
          });
      }
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(axe.violations.map((violation) => violation.id)).toEqual([]);
    }
  }
  async function grade(correct = true) {
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(
      page.getByRole('heading', {
        name: correct ? 'Correct' : 'Not quite yet',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Why this works', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'Answer feedback' }),
    ).toBeFocused();
  }
  async function begin(id: string) {
    await page.goto('/course/lesson/' + id);
    await page.getByRole('button', { name: 'Begin lesson' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    expect(await page.content()).not.toMatch(
      /correctOptionId|acceptedAnswers|correctOrder|correctPairs/,
    );
  }
  async function finish() {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Complete lesson' }).click();
    await expect(
      page.getByRole('heading', { name: 'Lesson completed.' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Lesson completed.' }),
    ).toBeVisible();
  }

  await begin('en-b1-present-perfect');
  expect(
    (
      await api.post('/api/exercises/attempt', {
        headers,
        data: { ...payload, activityId: 'en-b1-narrative-typed' },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await api.post('/api/exercises/attempt', {
        headers,
        data: { ...payload, contentVersion: 1 },
      })
    ).status(),
  ).toBe(409);
  expect(await page.content()).not.toContain(
    'Yesterday is a finished past time. Use past simple: sent.',
  );
  await inspectExercise('multiple-choice');
  expect(
    (
      await api.post('/api/exercises/attempt', {
        headers: { Origin: 'https://untrusted.example' },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await api.post('/api/exercises/attempt', {
        headers,
        data: {
          ...payload,
          answer: { type: 'typed_answer', text: 'Forged grading' },
        },
      })
    ).status(),
  ).toBe(400);
  await page
    .getByRole('radio', { name: 'I have sent the email yesterday.' })
    .check();
  await grade(false);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Not quite yet' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page
    .getByRole('radio', { name: 'I sent the email yesterday.' })
    .focus();
  await page.keyboard.press('Space');
  await grade();
  await inspectExercise('choice-feedback');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await inspectExercise('fill-gap');
  await page
    .getByLabel('Your answer', { exact: true })
    .fill('have been living');
  await page.route(
    '**/api/exercises/attempt',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"Temporary test failure"}',
      }),
    { times: 1 },
  );
  await page.getByLabel('Your answer', { exact: true }).press('Enter');
  await expect(
    page.getByRole('form', { name: 'Exercise answer' }).getByRole('alert'),
  ).toContainText('Your answer could not be saved');
  await expect(page.getByLabel('Your answer', { exact: true })).toHaveValue(
    'have been living',
  );
  const fillSubmission = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/exercises/attempt',
  );
  await grade();
  expect(
    (
      await api.post('/api/exercises/attempt', {
        headers,
        data: (await fillSubmission).postDataJSON(),
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await inspectExercise('error-correction');
  await page
    .getByLabel('Your answer', { exact: true })
    .fill('I went there yesterday.');
  await grade();
  await finish();
  await page.getByRole('link', { name: 'Return to learning path' }).click();
  await expect(page.getByText('1 / 5')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open A story with a clear sequence' }),
  ).toBeVisible();

  await begin('en-b1-narrative');
  await inspectExercise('sentence-reorder');
  for (const text of [
    'The train',
    'had already left',
    'when',
    'we',
    'arrived.',
  ]) {
    await page
      .getByRole('button', { name: 'Add ' + text, exact: true })
      .focus();
    await page.keyboard.press('Enter');
  }
  await page
    .getByRole('button', { name: 'Move when earlier', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Move when later', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await grade();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await inspectExercise('typed-answer');
  await page.getByLabel('Your answer', { exact: true }).fill(' HAD   LEFT ');
  await grade();
  await finish();

  await begin('en-b1-collocations');
  await inspectExercise('matching');
  await page.getByLabel('make', { exact: true }).selectOption('decision');
  await page.getByLabel('take', { exact: true }).selectOption('break');
  await page.getByLabel('keep', { exact: true }).selectOption('promise');
  await grade();
  await finish();

  await begin('en-b1-polite-requests');
  await inspectExercise('translation');
  await page
    .getByLabel('Your answer', { exact: true })
    .fill('Could you please send me the file by this evening?');
  await grade();
  await finish();

  await begin('en-b2-reading-inference');
  await page
    .getByRole('radio', {
      name: 'The evidence may be too limited for a firm conclusion.',
    })
    .check();
  await grade();
  await finish();
  await page.getByRole('link', { name: 'Return to learning path' }).click();
  await expect(page.getByText('5 / 5')).toBeVisible();
  await page.reload();
  await expect(page.getByText('5 / 5')).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Sign out' }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath('course-' + width + '-' + theme + '.png'),
        fullPage: true,
      });
    }
  }
  const rows = await drizzle(sql!, { schema })
    .select()
    .from(schema.exerciseAttempts)
    .where(eq(schema.exerciseAttempts.userId, userId!));
  expect(rows).toHaveLength(9);
  expect(rows.filter((row) => !row.isCorrect)).toHaveLength(1);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  await page.goto('/course');
  await expect(page).toHaveURL('/sign-in');
  // A new real Better Auth session for the same isolated fixture retains practice.
  const nextToken = randomBytes(32).toString('hex');
  await drizzle(sql!, { schema })
    .insert(schema.sessions)
    .values({
      userId: userId!,
      token: nextToken,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
  const nextSignature = createHmac('sha256', secret)
    .update(nextToken)
    .digest('base64');
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: encodeURIComponent(nextToken + '.' + nextSignature),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/course');
  await expect(page.getByText('5 / 5')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  expect(errors).toEqual([]);
});
