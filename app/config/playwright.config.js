import { defineConfig, devices } from '@playwright/test';

// Upstream 1.63.0 excludes Windows hosted CI WebKit video playback because of
// Windows Server Media Pack limitations. Keep its panel tests and all other
// OS/engine media tests. This does not claim Windows WebKit media support.
// https://github.com/microsoft/playwright/blob/v1.63.0/tests/library/capabilities.spec.ts#L62-L110
const windowsCi = Boolean(process.env.CI) && process.platform === 'win32';

export default defineConfig({
  testDir: '../tests',
  testMatch: '**/*.spec.js',
  outputDir: '../.artifacts/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  maxFailures: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    viewport: { width: 1000, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    {
      name: 'webkit', use: { ...devices['Desktop Safari'] },
      ...(windowsCi ? { testIgnore: ['**/playback.spec.js', '**/progress.spec.js'] } : {}),
    },
  ],
});
