import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
      testIgnore: /course-owner\.spec\.ts/,
    },
  ],
  webServer: {
    command:
      'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    env: {
      BETTER_AUTH_URL: 'http://127.0.0.1:3100',
      ...(process.env.E2E_OWNER_COURSE === '1'
        ? { GITHUB_OWNER_ID: '987654321012345678' }
        : {}),
    },
  },
  reporter: 'list',
});
