import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const controllerPath = fileURLToPath(new URL('../src/controller.js', import.meta.url));
const panelPath = fileURLToPath(new URL('../src/panel.js', import.meta.url));
async function openPanel(page, url = 'https://tutor-t.thinkforbl.com/courses/42') {
  await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Course fixture</title><main>Course</main>' }));
  await page.goto(url);
  await page.addScriptTag({ path: controllerPath });
  await page.addScriptTag({ path: panelPath });
}

test('installation stays idle until Start, Stop releases settings, and reinjection is idempotent', async ({ page }) => {
  await openPanel(page);
  await expect(page.locator('#vaa-panel')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '시작 / Start', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '정지 / Stop', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.__videoAutomationAgent?.status().running ?? false)).toBe(false);
  await expect(page.getByLabel('질문 건너뛰기 / Skip questions')).toBeChecked();
  await expect(page.getByLabel('100%까지 실행 / Until 100%')).toBeChecked();
  await expect(page.getByLabel('최대 실행 시간 / Maximum hours')).toBeDisabled();
  await page.getByLabel('100%까지 실행 / Until 100%').uncheck();
  await expect(page.getByLabel('최대 실행 시간 / Maximum hours')).toBeEnabled();
  await page.getByRole('button', { name: '시작 / Start', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__videoAutomationAgent.status().running)).toBe(true);
  await expect(page.getByLabel('최대 실행 시간 / Maximum hours')).toBeDisabled();
  await page.addScriptTag({ path: panelPath });
  await expect(page.locator('#vaa-panel')).toHaveCount(1);
  await page.getByRole('button', { name: '정지 / Stop', exact: true }).click();
  expect(await page.evaluate(() => window.__videoAutomationAgent.status().running)).toBe(false);
  await expect(page.getByLabel('최대 실행 시간 / Maximum hours')).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('정지');
});

test('invalid duration gives a useful error and does not start automation', async ({ page }) => {
  await openPanel(page);
  await page.getByLabel('100%까지 실행 / Until 100%').uncheck();
  for (const invalid of ['0', '25', '-1', '']) {
    await page.getByLabel('최대 실행 시간 / Maximum hours').fill(invalid);
    await page.getByRole('button', { name: '시작 / Start', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('24');
    expect(await page.evaluate(() => window.__videoAutomationAgent?.status().running ?? false)).toBe(false);
  }
  await page.getByLabel('최대 실행 시간 / Maximum hours').fill('1');
  await page.getByRole('button', { name: '시작 / Start', exact: true }).click();
  await expect(page.getByRole('alert')).toBeHidden();
  expect(await page.evaluate(() => window.__videoAutomationAgent.status().running)).toBe(true);
});

test('an unchecked skip choice leaves a real question skip button untouched', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => {
    document.querySelector('main').innerHTML = '<div class="cv-video-player is-gated"><video></video></div><div class="cv-ix-q-standby"><button class="cv-ix-q-standby-skip">Skip question</button></div>';
    window.questionSkipped = false;
    document.querySelector('.cv-ix-q-standby-skip').onclick = () => { window.questionSkipped = true; };
  });
  await page.getByLabel('질문 건너뛰기 / Skip questions').uncheck();
  await page.getByRole('button', { name: '시작 / Start', exact: true }).click();
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.questionSkipped)).toBe(false);
  await expect(page.getByRole('status')).toContainText('직접');
});

test('default goal mode shows precise site progress and stops only at recorded 100%', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => {
    document.querySelector('main').innerHTML = '<div class="cv-curriculum-progress"><span class="cv-curriculum-progress-value">100%</span><div class="cv-curriculum-progress-fill" style="width:99.9%"></div></div>';
  });
  await page.getByRole('button', { name: '시작 / Start', exact: true }).click();
  await expect(page.locator('#vaa-panel')).toContainText('99.9%');
  expect(await page.evaluate(() => window.__videoAutomationAgent.status().running)).toBe(true);
  await page.evaluate(() => { document.querySelector('.cv-curriculum-progress-fill').style.width = '100%'; });
  await expect(page.getByRole('status')).toContainText('100%');
  await expect.poll(() => page.evaluate(() => window.__videoAutomationAgent.status().running)).toBe(false);
  await expect(page.getByRole('button', { name: '시작 / Start', exact: true })).toBeEnabled();
  await expect(page.getByLabel('100%까지 실행 / Until 100%')).toBeEnabled();
  await expect(page.getByLabel('최대 실행 시간 / Maximum hours')).toBeDisabled();
});

test('a missing controller API gives a recoverable Start error', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => { delete window.VideoAutomationAgent; });
  await page.getByRole('button', { name: '시작 / Start', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('새로고침');
  await expect(page.getByRole('button', { name: '시작 / Start', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '정지 / Stop', exact: true })).toBeDisabled();
});

for (const url of ['https://example.com/courses/9', 'http://tutor-t.thinkforbl.com/courses/9',
  'https://tutor-t.thinkforbl.com/courses/9/edit', 'https://tutor-t.thinkforbl.com/courses/not-a-number']) {
  test(`the panel does not mount at ${url}`, async ({ page }) => {
    await openPanel(page, url);
    await expect(page.locator('#vaa-panel')).toHaveCount(0);
    expect(await page.evaluate(() => window.__videoAutomationAgent)).toBeUndefined();
  });
}
