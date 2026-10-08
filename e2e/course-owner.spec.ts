import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { databaseTlsOptions } from '../src/lib/database-tls';
import * as schema from '../src/server/db/schema';
import type { getDb } from '../src/server/db/client';
import { startLesson, advanceLesson } from '../src/server/course/repository';
import { submitExercise } from '../src/server/exercises/repository';
import { ensureReviewCard } from '../src/server/review/repository';

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

test.beforeEach(async () => {
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

test.afterEach(async () => {
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

test('Daily preview, bounded real work and completion persist securely', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const fixture = drizzle(sql!, { schema });
  const db = fixture as unknown as ReturnType<typeof getDb>;
  await fixture
    .update(schema.learnerProfiles)
    .set({ dailyMinutes: 5 })
    .where(eq(schema.learnerProfiles.userId, userId!));
  await startLesson(db, userId!, 'en-b1-present-perfect');
  await advanceLesson(db, userId!, 'en-b1-present-perfect', 0, 2);
  await submitExercise(db, userId!, 'en', {
    lessonId: 'en-b1-present-perfect',
    activityId: 'en-b1-present-perfect-choice',
    contentVersion: 2,
    submissionId: randomUUID(),
    answer: { type: 'multiple_choice', optionId: 'have-sent' },
  });
  const senses = await fixture.select().from(schema.vocabularySenses).limit(8);
  for (const sense of senses)
    await ensureReviewCard(db, userId!, sense.id, new Date(Date.now() - 60000));
  const cookie = (value: string) => ({
    name: 'better-auth.session_token',
    value: encodeURIComponent(
      value + '.' + createHmac('sha256', secret).update(value).digest('base64'),
    ),
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  });
  await page.context().addCookies([cookie(token)]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.name));
  const headers = { Origin: 'http://127.0.0.1:3100' };
  const api = page.context().request;
  expect(
    (await request.post('/api/daily/start', { headers, data: {} })).status(),
  ).toBe(401);
  expect((await api.get('/api/daily/start')).status()).toBe(405);
  expect(
    (
      await api.post('/api/daily/start', {
        headers: { Origin: 'https://untrusted.example' },
        data: {},
      })
    ).status(),
  ).toBe(403);
  for (const forged of [
    { userId: randomUUID() },
    { sessionId: randomUUID() },
    { targetMinutes: 60 },
    { completedMinutes: 5 },
    { items: [] },
    { sourceIds: [] },
    { plannerVersion: 'forged' },
  ])
    expect(
      (await api.post('/api/daily/start', { headers, data: forged })).status(),
    ).toBe(400);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Today’s goal', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Preview today’s plan' }).click();
  await expect(
    page.getByRole('heading', { name: '5-minute goal' }),
  ).toBeVisible();
  await page.reload();
  expect(
    await fixture
      .select()
      .from(schema.dailySessions)
      .where(eq(schema.dailySessions.userId, userId!)),
  ).toHaveLength(0);
  async function inspect(state: string) {
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
        if (width === 320 || width === 1280)
          await page.screenshot({
            path: testInfo.outputPath(`daily-${state}-${width}-${theme}.png`),
            fullPage: true,
          });
      }
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
    }
  }
  await inspect('preview');
  const start = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/daily/start') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Start today’s plan' }).focus();
  await page.keyboard.press('Enter');
  const id = (await (await start).json()).sessionId;
  await expect(
    page.getByText('0/3 tasks complete', { exact: true }),
  ).toBeVisible();
  const repeated = await Promise.all([
    api.post('/api/daily/start', { headers, data: {} }),
    api.post('/api/daily/start', { headers, data: {} }),
  ]);
  expect(
    await Promise.all(repeated.map(async (r) => (await r.json()).sessionId)),
  ).toEqual([id, id]);
  const savedItems = await fixture
    .select()
    .from(schema.dailySessionItems)
    .where(eq(schema.dailySessionItems.sessionId, id))
    .orderBy(schema.dailySessionItems.position);
  expect(savedItems.map((i) => i.kind)).toEqual([
    'review',
    'mistake',
    'lesson',
  ]);
  await fixture
    .update(schema.learnerProfiles)
    .set({ dailyMinutes: 20 })
    .where(eq(schema.learnerProfiles.userId, userId!));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '5-minute goal' }),
  ).toBeVisible();
  await inspect('started');
  await page.getByRole('link', { name: 'Continue today’s plan' }).click();
  await page.getByRole('button', { name: 'Start review' }).click();
  await expect(page).toHaveURL(/\/review\/session\/[0-9a-f-]+$/);
  const reviewUrl = page.url();
  const reviewTarget = savedItems.find((i) => i.kind === 'review')!.targetCount;
  for (let i = 0; i < reviewTarget; i++) {
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByRole('button', { name: /Good/ }).click();
  }
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(
    page.getByText('1/3 tasks complete', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Continue today’s plan' }).click();
  await page
    .getByRole('radio', { name: 'I have sent the email yesterday.' })
    .check();
  const submitted = page.waitForRequest(
    (r) => r.url().endsWith('/api/mistakes/practice') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Check answer' }).click();
  const payload = (await submitted).postDataJSON();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(
    (
      await api.post('/api/mistakes/practice', { headers, data: payload })
    ).status(),
  ).toBe(200);
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(
    page.getByText('2/3 tasks complete', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Continue today’s plan' }).click();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page
    .getByRole('radio', { name: 'I sent the email yesterday.', exact: true })
    .check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(
    page.getByRole('heading', { name: 'Correct', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Today’s plan is complete.' }),
  ).toBeVisible();
  await expect(
    page.getByText('3/3 tasks complete', { exact: true }),
  ).toBeVisible();
  await inspect('complete');
  const [completed] = await fixture
    .select()
    .from(schema.dailySessions)
    .where(eq(schema.dailySessions.id, id));
  expect(completed.completedAt).not.toBeNull();
  await page.goto(reviewUrl);
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: /Easy/ }).click();
  await page.goto('/daily');
  expect(
    (
      await fixture
        .select()
        .from(schema.dailySessions)
        .where(eq(schema.dailySessions.id, id))
    )[0],
  ).toEqual(completed);
  expect(
    await fixture
      .select()
      .from(schema.mistakePracticeAttempts)
      .where(eq(schema.mistakePracticeAttempts.userId, userId!)),
  ).toHaveLength(1);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  await page.goto('/daily');
  await expect(page).toHaveURL('/sign-in');
  const nextToken = randomBytes(32).toString('hex');
  await fixture.insert(schema.sessions).values({
    userId: userId!,
    token: nextToken,
    expiresAt: new Date(Date.now() + 1800000),
  });
  await page.context().addCookies([cookie(nextToken)]);
  await page.goto('/daily');
  await expect(
    page.getByText('3/3 tasks complete', { exact: true }),
  ).toBeVisible();
  expect(
    (
      await fixture
        .select()
        .from(schema.dailySessionItems)
        .where(eq(schema.dailySessionItems.sessionId, id))
    ).map((i) => [i.id, i.kind, i.targetCount]),
  ).toEqual(savedItems.map((i) => [i.id, i.kind, i.targetCount]));
  const [other] = await fixture
    .insert(schema.users)
    .values({
      email: `phase8-e2e-${randomUUID()}@example.test`,
      name: 'Isolated Daily learner',
      emailVerified: true,
    })
    .returning();
  const otherContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
  });
  try {
    await fixture
      .update(schema.accounts)
      .set({ accountId: 'phase8-inactive-fixture' })
      .where(eq(schema.accounts.userId, userId!));
    await fixture.insert(schema.accounts).values({
      userId: other.id,
      providerId: 'github',
      accountId: fixtureOwnerId,
    });
    await fixture.insert(schema.learnerProfiles).values({
      userId: other.id,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
      dailyMinutes: 20,
    });
    const otherToken = randomBytes(32).toString('hex');
    await fixture.insert(schema.sessions).values({
      userId: other.id,
      token: otherToken,
      expiresAt: new Date(Date.now() + 1800000),
    });
    await otherContext.addCookies([cookie(otherToken)]);
    const otherPage = await otherContext.newPage();
    await otherPage.goto('/daily');
    await expect(
      otherPage.getByRole('heading', { name: '20-minute goal' }),
    ).toBeVisible();
    await expect(
      otherPage.getByRole('button', { name: 'Start today’s plan' }),
    ).toBeVisible();
    expect(
      (
        await otherContext.request.post('/api/daily/start', {
          headers,
          data: { sessionId: id },
        })
      ).status(),
    ).toBe(400);
    await otherPage.getByRole('button', { name: 'Start today’s plan' }).click();
    await expect(
      otherPage.getByText('0/1 tasks complete', { exact: true }),
    ).toBeVisible();
    const [otherPlan] = await fixture
      .select()
      .from(schema.dailySessions)
      .where(eq(schema.dailySessions.userId, other.id));
    expect(otherPlan.id).not.toBe(id);
    expect(otherPlan.targetMinutes).toBe(20);
  } finally {
    await otherContext.close();
    await fixture.delete(schema.users).where(eq(schema.users.id, other.id));
    await fixture
      .update(schema.accounts)
      .set({ accountId: fixtureOwnerId })
      .where(eq(schema.accounts.userId, userId!));
  }
  expect(errors).toEqual([]);
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

  await page.goto('/vocabulary');
  await expect(page.getByText('0 items')).toBeVisible();
  await page.getByRole('button', { name: 'Explore' }).click();
  await expect(page.getByText('16 items')).toBeVisible();
  await page.getByLabel('Search').fill('decision');
  await expect(
    page.getByRole('link', { name: 'decision', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Search').fill('');
  await page.goto('/course/lesson/en-b1-collocations');
  await page.getByRole('button', { name: 'Begin lesson' }).click();
  await expect(
    page.getByRole('region', { name: 'New vocabulary' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Match each verb to its natural everyday collocation.',
    }),
  ).toBeVisible();
  await page.goto('/vocabulary');
  await expect(page.getByText('3 items')).toBeVisible();
  await page.getByRole('link', { name: 'decision', exact: true }).click();
  await expect(page.locator('.subtitle')).toContainText('encountered');
  await page.getByRole('button', { name: 'Save word' }).click();
  await expect(
    page.getByRole('button', { name: 'Remove from saved' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Remove from saved' }),
  ).toBeVisible();
  await page.goto('/vocabulary');
  await page.getByRole('button', { name: 'Saved' }).click();
  await expect(
    page.getByRole('link', { name: 'decision', exact: true }),
  ).toBeVisible();
  await page.goto('/review');
  await expect(
    page.getByRole('heading', { name: '3 reviews due' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start review' }).click();
  await expect(page.locator('.review-card .eyebrow')).toContainText(
    'CARD 1 OF 3',
  );
  const reviewSessionUrl = page.url();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.getByRole('heading', { name: 'Meaning' })).toBeVisible();
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
      if (width === 320 || (width === 1280 && theme === 'light'))
        await page.screenshot({
          path: testInfo.outputPath(`review-card-${width}-${theme}.png`),
          fullPage: true,
        });
    }
    const cardAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(cardAxe.violations.map((violation) => violation.id)).toEqual([]);
  }
  const reviewRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/review/rate',
  );
  await page.keyboard.press('1');
  const firstReviewPayload = (await reviewRequest).postDataJSON();
  await expect(page.locator('.review-card .eyebrow')).toContainText(
    'CARD 2 OF 3',
  );
  expect(
    (
      await api.post('/api/review/rate', {
        headers,
        data: { ...firstReviewPayload, due: new Date().toISOString() },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await api.post('/api/review/rate', {
        headers: { Origin: 'https://untrusted.example' },
        data: firstReviewPayload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await api.post('/api/review/rate', { headers, data: firstReviewPayload })
    ).status(),
  ).toBe(200);
  expect(
    await drizzle(sql!, { schema })
      .select()
      .from(schema.reviewHistory)
      .where(eq(schema.reviewHistory.userId, userId!)),
  ).toHaveLength(1);
  await page.reload();
  await expect(page).toHaveURL(reviewSessionUrl);
  await expect(page.locator('.review-card .eyebrow')).toContainText(
    'CARD 2 OF 3',
  );
  await page.getByRole('button', { name: 'Show answer' }).click();
  const sessionId = reviewSessionUrl.split('/').at(-1)!;
  const [secondItem] = await drizzle(sql!, { schema })
    .select()
    .from(schema.reviewSessionItems)
    .where(eq(schema.reviewSessionItems.sessionId, sessionId))
    .orderBy(schema.reviewSessionItems.position)
    .offset(1)
    .limit(1);
  const secondPayload = {
    sessionId,
    itemId: secondItem.id,
    cardId: secondItem.cardId,
    submissionId: randomUUID(),
    rating: 'Good',
  };
  const concurrent = await Promise.all([
    api.post('/api/review/rate', { headers, data: secondPayload }),
    api.post('/api/review/rate', { headers, data: secondPayload }),
  ]);
  expect(concurrent.map((response) => response.status())).toEqual([200, 200]);
  expect(
    (await Promise.all(concurrent.map((response) => response.json())))
      .map((result) => result.replay)
      .sort(),
  ).toEqual([false, true]);
  expect(
    await drizzle(sql!, { schema })
      .select()
      .from(schema.reviewHistory)
      .where(eq(schema.reviewHistory.userId, userId!)),
  ).toHaveLength(2);
  await page.reload();
  await expect(page.locator('.review-card .eyebrow')).toContainText(
    'CARD 3 OF 3',
  );
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: /Easy/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Session summary' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(
    page.getByRole('heading', { name: 'Review complete.' }),
  ).toBeVisible();
  await page.goto('/review');
  await expect(
    page.getByRole('heading', { name: '0 reviews due' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '3 reviews' })).toBeVisible();
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
    }
    const reviewAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      reviewAxe.violations.map((violation) => violation.id),
      JSON.stringify({
        theme,
        nodes: reviewAxe.violations.flatMap((violation) =>
          violation.nodes.map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
          })),
        ),
      }),
    ).toEqual([]);
  }
  await page.goto('/');
  await expect(page.getByText('0 reviews due')).toBeVisible();
  await page.goto('/course/lesson/en-b1-collocations');
  await inspectExercise('matching');
  await page.getByLabel('make', { exact: true }).selectOption('decision');
  await page.getByLabel('take', { exact: true }).selectOption('break');
  await page.getByLabel('keep', { exact: true }).selectOption('promise');
  await grade();
  await page.goto('/vocabulary');
  await expect(
    page.locator('.vocab-meta').filter({ hasText: 'practising' }).first(),
  ).toBeVisible();
  await page.getByLabel('CEFR').selectOption('B1');
  await page.getByLabel('Tag').selectOption('collocation');
  await expect(page.getByText('3 items')).toBeVisible();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const vocabularyAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(vocabularyAxe.violations.map((violation) => violation.id)).toEqual([]);
  await page.goto('/course/lesson/en-b1-collocations');
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
  await page.goto('/mistakes');
  await expect(
    page.getByRole('heading', { name: 'Mistake Center' }),
  ).toBeVisible();
  await expect(
    page.getByText('1 recorded error', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Past simple and present perfect', exact: true })
    .click();
  await expect(page.getByText('Current state: needs practice')).toBeVisible();
  await expect(
    page
      .locator('p')
      .filter({ hasText: 'Your answer: I have sent the email yesterday.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Practice again', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Check answer', exact: true }),
  ).toBeVisible();
  // A fresh response excludes RSC scripts retained from the already-graded history page.
  const practiceMarkup = await (
    await api.get('/mistakes/en-past-present-perfect/practice')
  ).text();
  expect(practiceMarkup).not.toContain('correctOptionId');
  expect(practiceMarkup).not.toContain('Yesterday is a finished past time.');
  const practiceRequest = {
    weaknessId: 'en-past-present-perfect',
    activityId: 'en-b1-present-perfect-choice',
    contentVersion: 2,
    submissionId: randomUUID(),
    answer: { type: 'multiple_choice', optionId: 'have-sent' },
  };
  for (const forged of [
    { userId: randomUUID() },
    { isCorrect: true },
    { recurrence: 0 },
    { status: 'recovered' },
  ])
    expect(
      (
        await api.post('/api/mistakes/practice', {
          headers,
          data: { ...practiceRequest, ...forged },
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await api.post('/api/mistakes/practice', {
        headers,
        data: { ...practiceRequest, activityId: 'en-b1-narrative-typed' },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await api.post('/api/mistakes/practice', {
        headers,
        data: { ...practiceRequest, weaknessId: 'unknown' },
      })
    ).status(),
  ).toBe(409);
  const stateBeforePractice = await sql!`select
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from lesson_progress t where user_id = ${userId!}) as progress,
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from vocabulary_evidence t where user_id = ${userId!}) as vocabulary,
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from review_cards t where user_id = ${userId!}) as cards,
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from review_history t where user_id = ${userId!}) as reviews`;
  await page
    .getByRole('radio', { name: 'I have sent the email yesterday.' })
    .check();
  const submission = page.waitForRequest(
    (r) => r.url().endsWith('/api/mistakes/practice') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Check answer', exact: true }).focus();
  await page.keyboard.press('Enter');
  const submitted = (await submission).postDataJSON();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  const replays = await Promise.all([
    api.post('/api/mistakes/practice', { headers, data: submitted }),
    api.post('/api/mistakes/practice', { headers, data: submitted }),
  ]);
  expect(replays.map((r) => r.status())).toEqual([200, 200]);
  expect((await replays[0].json()).result.attemptId).toBe(
    (await replays[1].json()).result.attemptId,
  );
  await page.getByRole('button', { name: 'Try again' }).click();
  await page
    .getByRole('radio', { name: 'I sent the email yesterday.', exact: true })
    .check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('link', { name: 'Return to area', exact: true }).click();
  await expect(page.getByText('Current state: recovered')).toBeVisible();
  await expect(
    page.getByText('2 recorded errors', { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Current state: recovered')).toBeVisible();
  for (const route of [
    '/mistakes',
    '/mistakes/en-past-present-perfect',
    '/mistakes/en-past-present-perfect/practice',
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole('link', { name: 'Mistakes', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
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
      }
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(
          `mistakes-${route.split('/').length}-${theme}.png`,
        ),
        fullPage: true,
      });
    }
  }
  await page.goto('/review');
  await expect(
    page.getByText('Areas needing practice: 0.', { exact: false }),
  ).toBeVisible();
  // A new failed corrective attempt reactivates the area without course traversal.
  expect(
    (
      await api.post('/api/mistakes/practice', {
        headers,
        data: practiceRequest,
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await expect(
    page.getByText('Areas needing practice: 1.', { exact: false }),
  ).toBeVisible();
  const stateAfterPractice = await sql!`select
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from lesson_progress t where user_id = ${userId!}) as progress,
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from vocabulary_evidence t where user_id = ${userId!}) as vocabulary,
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from review_cards t where user_id = ${userId!}) as cards,
    (select md5(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text)) from review_history t where user_id = ${userId!}) as reviews`;
  expect([...stateAfterPractice]).toEqual([...stateBeforePractice]);
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
  await page.goto('/vocabulary');
  await page.getByRole('button', { name: 'Saved' }).click();
  await expect(
    page.getByRole('link', { name: 'decision', exact: true }),
  ).toBeVisible();
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: '3 reviews' })).toBeVisible();
  await page.goto('/mistakes/en-past-present-perfect');
  await expect(page.getByText('Current state: repeated')).toBeVisible();
  await expect(
    page.getByText('3 recorded errors', { exact: false }),
  ).toBeVisible();
  // Only temporary fixture identities participate in the isolation check.
  const fixtureDb = drizzle(sql!, { schema });
  const [other] = await fixtureDb
    .insert(schema.users)
    .values({
      email: `phase4-e2e-${randomUUID()}@example.test`,
      name: 'Isolated learner',
      emailVerified: true,
    })
    .returning();
  const otherContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
  });
  try {
    await fixtureDb
      .update(schema.accounts)
      .set({ accountId: 'phase7-fixture-temporarily-inactive' })
      .where(eq(schema.accounts.userId, userId!));
    await fixtureDb.insert(schema.accounts).values({
      userId: other.id,
      providerId: 'github',
      accountId: fixtureOwnerId,
    });
    await fixtureDb.insert(schema.learnerProfiles).values({
      userId: other.id,
      nativeLanguage: 'ro',
      learningLanguage: 'en',
    });
    const otherToken = randomBytes(32).toString('hex');
    await fixtureDb.insert(schema.sessions).values({
      userId: other.id,
      token: otherToken,
      expiresAt: new Date(Date.now() + 30 * 60000),
    });
    await otherContext.addCookies([
      {
        name: 'better-auth.session_token',
        value: encodeURIComponent(
          otherToken +
            '.' +
            createHmac('sha256', secret).update(otherToken).digest('base64'),
        ),
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const otherPage = await otherContext.newPage();
    await otherPage.goto('/mistakes');
    await expect(otherPage.getByText('No recorded mistakes yet')).toBeVisible();
    await otherPage.goto('/mistakes/en-past-present-perfect');
    await expect(
      otherPage.getByText('Your answer:', { exact: false }),
    ).toHaveCount(0);
    await otherPage.goto('/mistakes/en-past-present-perfect/practice');
    await expect(
      otherPage.getByRole('heading', { name: 'Practice unavailable' }),
    ).toBeVisible();
    expect(
      (
        await otherContext.request.post('/api/mistakes/practice', {
          headers,
          data: { ...practiceRequest, submissionId: randomUUID() },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await otherContext.close();
    await fixtureDb.delete(schema.users).where(eq(schema.users.id, other.id));
    await fixtureDb
      .update(schema.accounts)
      .set({ accountId: fixtureOwnerId })
      .where(eq(schema.accounts.userId, userId!));
  }
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  expect(errors).toEqual([]);
});
