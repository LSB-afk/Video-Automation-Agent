import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const courseOrigin = 'https://tutor-t.thinkforbl.com';
const fixtureUrl = new URL('./', import.meta.url);
const controllerPath = fileURLToPath(new URL('../../src/controller.js', import.meta.url));

export async function installFixture(page, { course = 9, skipInteractions = true, untilComplete = false } = {}) {
  const html = await readFile(new URL('course.html', fixtureUrl), 'utf8');
  await page.route(`${courseOrigin}/**`, async route => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/^\/fixtures\/(clip\.(mp4|webm))$/);
    if (!match) {
      await route.fulfill({ contentType: 'text/html', body: html });
      return;
    }
    const bytes = await readFile(new URL(match[1], fixtureUrl));
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    await route.fulfill({
      status: range ? 206 : 200,
      contentType: `video/${match[2]}`,
      headers: {
        'accept-ranges': 'bytes',
        ...(range ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {}),
      },
      body: bytes.subarray(start, end + 1),
    });
  });
  await page.goto(`${courseOrigin}/courses/${course}`);
  await page.waitForFunction(() => document.querySelector('.cv-video-player > video').readyState >= 2);
  await page.addScriptTag({ path: controllerPath });
  await page.evaluate(options => {
    window.__testController = window.VideoAutomationAgent.createController({
      courseUrl: location.href,
      ...options,
    });
  }, { skipInteractions, untilComplete });
}
