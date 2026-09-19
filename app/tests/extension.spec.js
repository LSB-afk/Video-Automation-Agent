import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test('unpacked Chromium extension injects the panel without automatically starting', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright extension loading requires bundled Chromium; other engines test shared content separately.');
  const extensionPath = fileURLToPath(new URL('../.artifacts/dist/chromium', import.meta.url));
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    await context.route('**/*', (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Extension fixture</title><main>Course</main>',
    }));
    const page = await context.newPage();
    await page.goto('https://tutor-t.thinkforbl.com/courses/42');
    await expect(page.locator('#vaa-panel')).toHaveCount(1);
    await expect(page.getByRole('status')).toContainText('Ready');
    await expect(page.getByRole('button', { name: '시작 / Start', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '정지 / Stop', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '시작 / Start', exact: true }).click();
    await expect(page.getByRole('button', { name: '정지 / Stop', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '정지 / Stop', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('stopped');
    await page.goto('https://example.com/courses/42');
    await expect(page.locator('#vaa-panel')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
