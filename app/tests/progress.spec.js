import { test, expect } from '@playwright/test';
import { installFixture } from './fixtures/browser-fixture.js';

const mainSelector = '.cv-video-player > video';
const step = page => page.evaluate(() => window.__testController.step());

async function progress(page, label, width = null) {
  await page.evaluate(({ label, width }) => {
    document.querySelector('.cv-curriculum-progress')?.remove();
    const section = document.createElement('div');
    section.className = 'cv-curriculum-progress';
    const value = document.createElement('span');
    value.className = 'cv-curriculum-progress-value';
    value.textContent = label;
    section.append(value);
    if (width !== null) {
      const fill = document.createElement('div');
      fill.className = 'cv-curriculum-progress-fill';
      fill.style.width = width;
      section.append(fill);
    }
    document.body.prepend(section);
  }, { label, width });
}

async function finalLesson(page) {
  await page.locator('.cv-next-chapter-btn').evaluate(button => {
    button.remove();
    document.body.insertAdjacentHTML('beforeend', '<span class="cv-next-chapter-last">Last</span>');
  });
}

test.beforeEach(async ({ page }) => installFixture(page, { untilComplete: true }));

test('observed course progress 100 stops before further playback or Next', async ({ page }) => {
  await progress(page, '100%', '100%');
  const state = await page.evaluate(() => window.__testController.start());
  expect(state.status).toBe('course_completed');
  expect(state.running).toBe(false);
  expect(await page.evaluate(() => window.nextClicks)).toBe(0);
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
});

test('rounded 100 display with precise 99.9 bar keeps running', async ({ page }) => {
  await progress(page, '100%', '99.9%');
  const state = await page.evaluate(() => window.__testController.start());
  expect(state.status).not.toBe('course_completed');
  expect(state.running).toBe(true);
  expect(state.course_progress).toBe(99.9);
});

test('a precise course progress value is reported without rounding', async ({ page }) => {
  await progress(page, '3%', '3.88%');
  expect((await step(page)).course_progress).toBe(3.88);
});

test('video progress and unrelated 100 percent text cannot complete the course', async ({ page }) => {
  await progress(page, '99%', '99%');
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div class="cv-video-progress" style="width:100%">100%</div><p>100% complete</p>'));
  const state = await page.evaluate(() => window.__testController.start());
  expect(state.status).not.toBe('course_completed');
  expect(state.running).toBe(true);
  expect(state.course_progress).toBe(99);
});

test('invalid course percentages never count as complete', async ({ page }) => {
  for (const [label, width] of [['unknown', '100%'], ['101%', '101%'], ['100%', '-1%'], ['100%', '40px']]) {
    await progress(page, label, width);
    expect((await step(page)).status).not.toBe('course_completed');
  }
});

test('a 100 percent label can stop when the site provides no progress bar', async ({ page }) => {
  await progress(page, '100%');
  const state = await page.evaluate(() => window.__testController.start());
  expect(state.status).toBe('course_completed');
  expect(state.running).toBe(false);
});

test('final native end below 100 waits when every curriculum item is complete', async ({ page }) => {
  await progress(page, '99%', '99%');
  await finalLesson(page);
  await page.evaluate(() => window.__testController.start());
  await page.waitForFunction(() => document.querySelector('.cv-video-player > video').ended);
  const state = await step(page);
  expect(state.status).toBe('waiting_for_course_completion');
  expect(state.running).toBe(true);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(1);
  expect(await page.locator(mainSelector).evaluate(video => video.ended)).toBe(true);
  expect((await step(page)).status).toBe('waiting_for_course_completion');
});

test('after the final video an incomplete lesson is selected using its normal UI', async ({ page }) => {
  await progress(page, '75%', '75%');
  await finalLesson(page);
  await page.evaluate(() => {
    window.reviewClicks = 0;
    const item = document.createElement('div');
    item.className = 'cv-curriculum-item';
    item.innerHTML = '<span class="cv-curriculum-status-icon"></span><span class="cv-curriculum-item-title">Previously incomplete</span>';
    item.onclick = () => {
      window.reviewClicks++;
      document.querySelector('.cv-curriculum-item.is-active').classList.remove('is-active');
      item.classList.add('is-active');
      document.querySelector('.cv-video-player > video').src = secondClip;
    };
    document.body.append(item);
  });
  await page.evaluate(() => window.__testController.start());
  expect(await page.evaluate(() => window.reviewClicks)).toBe(0);
  await page.waitForFunction(() => document.querySelector('.cv-video-player > video').ended);
  await expect.poll(async () => { await step(page); return page.evaluate(() => window.reviewClicks); }).toBe(1);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(1);
  await expect(page.locator('.cv-curriculum-item.is-active')).toHaveText('Previously incomplete');
  await expect.poll(async () => {
    await step(page);
    return page.locator(mainSelector).evaluate(video => video.currentTime > 0 && !video.paused);
  }).toBe(true);
});

test('review expands a closed curriculum chapter before selecting its incomplete lesson', async ({ page }) => {
  await progress(page, '75%', '75%');
  await finalLesson(page);
  await page.evaluate(() => {
    window.expansions = 0;
    window.reviewClicks = 0;
    const chapter = document.createElement('div');
    chapter.className = 'cv-curriculum-chapter';
    chapter.innerHTML = '<button class="cv-curriculum-chapter-toggle">Earlier chapter</button><div class="children" hidden><div class="cv-curriculum-item"><span class="cv-curriculum-status-icon"></span><span class="cv-curriculum-item-title">Hidden incomplete</span></div></div>';
    chapter.querySelector('button').onclick = () => {
      window.expansions++;
      chapter.classList.add('is-open');
      chapter.querySelector('.children').hidden = false;
    };
    const item = chapter.querySelector('.cv-curriculum-item');
    item.onclick = () => {
      window.reviewClicks++;
      document.querySelector('.cv-curriculum-item.is-active').classList.remove('is-active');
      item.classList.add('is-active');
      document.querySelector('.cv-video-player > video').src = secondClip;
    };
    document.body.append(chapter);
  });
  await page.evaluate(() => window.__testController.start());
  await page.waitForFunction(() => document.querySelector('.cv-video-player > video').ended);
  await expect.poll(async () => { await step(page); return page.evaluate(() => window.reviewClicks); }).toBe(1);
  expect(await page.evaluate(() => window.expansions)).toBe(1);
  await expect(page.locator('.cv-curriculum-item.is-active')).toHaveText('Hidden incomplete');
});

test('an incomplete final lesson can replay only through its normal Play button', async ({ page }) => {
  await progress(page, '99%', '99%');
  await finalLesson(page);
  await page.evaluate(() => {
    window.playClicks = 0;
    const main = document.querySelector('.cv-video-player > video');
    main.onended = () => window.nativeEnds++;
    document.querySelector('.cv-video-control-btn').onclick = () => {
      window.playClicks++;
      return main.paused ? main.play() : main.pause();
    };
  });
  await page.evaluate(() => window.__testController.start());
  await page.waitForFunction(() => document.querySelector('.cv-video-player > video').ended);
  expect(await page.evaluate(() => window.playClicks)).toBe(1);
  await expect.poll(async () => {
    await step(page);
    return page.locator(mainSelector).evaluate(video => video.currentTime > 0 && !video.paused);
  }, { timeout: 6000 }).toBe(true);
  expect(await page.evaluate(() => window.playClicks)).toBe(2);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(1);
  await expect(page.locator('.is-completed')).toHaveCount(0);
});

test('review rotates through incomplete lessons even when checkmarks never arrive', async ({ page }) => {
  await progress(page, '50%', '50%');
  await finalLesson(page);
  await page.evaluate(() => {
    window.reviewedLessons = [];
    const main = document.querySelector('.cv-video-player > video');
    main.onended = () => window.nativeEnds++;
    const current = document.querySelector('.cv-curriculum-item');
    current.querySelector('.cv-curriculum-item-title').textContent = 'Final';
    current.querySelector('.cv-curriculum-status-icon').classList.add('is-completed');
    for (const title of ['A', 'B', 'C']) {
      const item = current.cloneNode(true);
      item.classList.remove('is-active');
      item.querySelector('.cv-curriculum-status-icon').classList.remove('is-completed');
      item.querySelector('.cv-curriculum-item-title').textContent = title;
      current.before(item);
    }
    for (const item of document.querySelectorAll('.cv-curriculum-item')) {
      item.onclick = () => {
        const title = item.querySelector('.cv-curriculum-item-title').textContent;
        window.reviewedLessons.push(title);
        document.querySelector('.cv-curriculum-item.is-active').classList.remove('is-active');
        item.classList.add('is-active');
        main.src = `${firstClip}&review=${title}`;
      };
    }
  });
  await page.evaluate(() => window.__testController.start());
  await expect.poll(async () => {
    await step(page);
    return page.evaluate(() => window.reviewedLessons.length);
  }, { timeout: 18000, intervals: [80, 100] }).toBe(3);
  expect(await page.evaluate(() => window.reviewedLessons)).toEqual(['A', 'B', 'C']);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(3);
  expect(await page.evaluate(() => window.nextClicks)).toBe(0);
  await expect(page.locator('.is-completed')).toHaveCount(1);
});

test('review passes a text-only item after the site marks it complete and resumes real video', async ({ page }) => {
  await progress(page, '50%', '50%');
  await finalLesson(page);
  await page.evaluate(() => {
    window.textClicks = 0;
    window.reviewVideoClicks = 0;
    window.siteTextCompletions = 0;
    const player = document.querySelector('.cv-video-player');
    const main = player.querySelector('video');
    const current = document.querySelector('.cv-curriculum-item');
    current.querySelector('.cv-curriculum-item-title').textContent = 'Final video';
    for (const title of ['Text-only lesson', 'Missing video']) {
      const item = current.cloneNode(true);
      item.classList.remove('is-active');
      item.querySelector('.cv-curriculum-item-title').textContent = title;
      item.onclick = () => {
        document.querySelector('.cv-curriculum-item.is-active').classList.remove('is-active');
        item.classList.add('is-active');
        if (title === 'Text-only lesson') {
          window.textClicks++;
          window.textSelectedAt = performance.now();
          player.remove();
          setTimeout(() => {
            window.siteTextCompletions++;
            item.querySelector('.cv-curriculum-status-icon').classList.add('is-completed');
          }, 150);
        } else {
          window.reviewVideoClicks++;
          window.videoSelectedAt = performance.now();
          document.body.append(player);
          main.src = secondClip;
        }
      };
      current.before(item);
    }
  });
  await page.evaluate(() => window.__testController.start());
  await page.waitForFunction(() => document.querySelector('.cv-video-player > video').ended);
  await expect.poll(async () => { await step(page); return page.evaluate(() => window.textClicks); }).toBe(1);
  await expect(page.locator(mainSelector)).toHaveCount(0);
  expect(await page.evaluate(() => window.reviewVideoClicks)).toBe(0);
  await page.waitForFunction(() => window.siteTextCompletions === 1);
  expect(await page.evaluate(() => window.reviewVideoClicks)).toBe(0);
  await expect.poll(async () => { await step(page); return page.evaluate(() => window.reviewVideoClicks); }, { timeout: 6000 }).toBe(1);
  expect(await page.evaluate(() => window.videoSelectedAt - window.textSelectedAt)).toBeGreaterThanOrEqual(2900);
  expect(await page.evaluate(() => window.siteTextCompletions)).toBe(1);
  expect(await page.evaluate(() => window.textClicks)).toBe(1);
  await expect.poll(async () => {
    await step(page);
    return page.locator(mainSelector).evaluate(video => video.currentTime > 0 && !video.paused);
  }).toBe(true);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(1);
});

test('a site-completed text-only lesson advances normally once after settling', async ({ page }) => {
  await progress(page, '20%', '20%');
  await page.evaluate(() => {
    const player = document.querySelector('.cv-video-player');
    const main = player.querySelector('video');
    player.remove();
    const item = document.querySelector('.cv-curriculum-item');
    item.querySelector('.cv-curriculum-item-title').textContent = 'Completed text';
    item.querySelector('.cv-curriculum-status-icon').classList.add('is-completed');
    window.textSelectedAt = performance.now();
    document.querySelector('.cv-next-chapter-btn').onclick = () => {
      window.nextClicks++;
      window.videoSelectedAt = performance.now();
      setTimeout(() => {
        item.querySelector('.cv-curriculum-item-title').textContent = 'Following video';
        item.querySelector('.cv-curriculum-status-icon').classList.remove('is-completed');
        document.body.append(player);
        main.src = secondClip;
      }, 200);
    };
  });
  await page.evaluate(() => window.__testController.start());
  expect(await page.evaluate(() => window.nextClicks)).toBe(0);
  await expect.poll(async () => { await step(page); return page.evaluate(() => window.nextClicks); }, { timeout: 6000 }).toBe(1);
  for (let i = 0; i < 3; i++) await step(page);
  expect(await page.evaluate(() => window.nextClicks)).toBe(1);
  expect(await page.evaluate(() => window.videoSelectedAt - window.textSelectedAt)).toBeGreaterThanOrEqual(2900);
  await expect.poll(async () => {
    await step(page);
    return page.evaluate(() => {
      const video = document.querySelector('.cv-video-player > video');
      return Boolean(video && video.currentTime > 0 && !video.paused);
    });
  }).toBe(true);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(0);
});

test('an unknown incomplete text-only lesson remains waiting without completion changes', async ({ page }) => {
  await progress(page, '20%', '20%');
  await page.locator('.cv-video-player').evaluate(player => player.remove());
  await page.evaluate(() => window.__testController.start());
  await page.waitForTimeout(3200);
  expect((await step(page)).status).toBe('waiting_for_video');
  expect(await page.evaluate(() => window.nextClicks)).toBe(0);
  await expect(page.locator('.is-completed')).toHaveCount(0);
});

test('goal mode respects manual pause and an explicit Stop', async ({ page }) => {
  await progress(page, '10%', '10%');
  await page.evaluate(() => window.__testController.start());
  await page.waitForFunction(() => !document.querySelector('.cv-video-player > video').paused);
  await page.locator(mainSelector).evaluate(video => video.pause());
  expect((await step(page)).status).toBe('paused');
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
  await page.evaluate(() => window.__testController.stop());
  expect(await page.evaluate(() => window.__testController.status().running)).toBe(false);
});

test('goal mode does not silently stop at the standard twelve hour deadline', async ({ page }) => {
  await progress(page, '10%', '10%');
  const state = await page.evaluate(() => {
    const originalInterval = window.setInterval.bind(window);
    window.setInterval = (callback, ...args) => {
      window.__capturedTick = callback;
      return originalInterval(callback, ...args);
    };
    window.__testController.start();
    document.querySelector('.cv-video-player > video').pause();
    const originalNow = Date.now;
    Date.now = () => originalNow() + 13 * 60 * 60 * 1000;
    window.__capturedTick();
    return window.__testController.status();
  });
  expect(state.running).toBe(true);
  expect(state.status).toBe('paused');
});
