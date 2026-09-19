import { test, expect } from '@playwright/test';
import { installFixture } from './fixtures/browser-fixture.js';

const mainSelector = '.cv-video-player > video';

const step = page => page.evaluate(() => window.__testController.step());
const nextClicks = page => page.evaluate(() => window.nextClicks);
const nativeEnd = page => page.waitForFunction(() => document.querySelector('.cv-video-player > video').ended);
const isPlaying = page => page.locator(mainSelector).evaluate(video => video.currentTime > 0 && !video.paused);

async function tickUntil(page, predicate, timeout = 6000) {
  await expect.poll(async () => {
    await step(page);
    return predicate();
  }, { timeout, intervals: [60, 80, 100] }).toBe(true);
}

async function addQuestion(page) {
  await page.evaluate(() => {
    const main = document.querySelector('.cv-video-player > video');
    main.pause();
    main.parentElement.classList.add('is-gated');
    window.skips = 0;
    window.submissions = 0;
    const overlay = document.createElement('div');
    overlay.className = 'cv-ix-q-standby';
    overlay.innerHTML = '<input><button class="cv-ix-q-standby-skip">Skip</button><button class="submit-answer">Submit</button>';
    overlay.querySelector('.submit-answer').onclick = () => window.submissions++;
    overlay.querySelector('.cv-ix-q-standby-skip').onclick = () => {
      window.skips++;
      overlay.remove();
      main.parentElement.classList.remove('is-gated');
    };
    document.body.append(overlay);
  });
}

test.beforeEach(async ({ page }) => installFixture(page));

test('natural end advances exactly once and starts the next video', async ({ page }) => {
  await step(page);
  await expect.poll(() => isPlaying(page)).toBe(true);
  expect(await nextClicks(page)).toBe(0);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(0);
  await tickUntil(page, async () => await nextClicks(page) === 1);
  expect(await page.evaluate(() => window.nativeEnds)).toBe(1);
  await tickUntil(page, () => isPlaying(page));
  expect(await nextClicks(page)).toBe(1);
});

test('unknown question gate prevents playback and navigation', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('.cv-video-player').classList.add('is-gated');
    document.body.insertAdjacentHTML('beforeend', '<div class="cv-ix-q-standby">Question</div>');
  });
  expect((await step(page)).status).toBe('waiting_for_interaction');
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
  expect(await nextClicks(page)).toBe(0);
});

test('manual pause remains paused on following ticks', async ({ page }) => {
  await step(page);
  await expect.poll(() => isPlaying(page)).toBe(true);
  await page.locator(mainSelector).evaluate(video => video.pause());
  expect((await step(page)).status).toBe('paused');
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
});

test('an unrelated ended clip cannot complete the main lecture', async ({ page }) => {
  await page.evaluate(() => {
    const video = document.createElement('video');
    video.className = 'cv-ix-popup-video';
    video.src = firstClip;
    video.muted = true;
    video.playsInline = true;
    document.body.prepend(video);
    return video.play();
  });
  await page.waitForFunction(() => document.querySelector('.cv-ix-popup-video').ended);
  await step(page);
  expect(await nextClicks(page)).toBe(0);
  await expect.poll(() => isPlaying(page)).toBe(true);
});

test('native end initially waits for the site completion indicator', async ({ page }) => {
  await page.locator(mainSelector).evaluate(video => { video.onended = null; });
  await step(page);
  await nativeEnd(page);
  expect((await step(page)).status).toBe('waiting_for_recorded_completion');
  expect(await nextClicks(page)).toBe(0);
});

test('a delayed navigation cannot receive duplicate Next clicks', async ({ page }) => {
  await page.locator('.cv-next-chapter-btn').evaluate(button => {
    button.onclick = () => window.nextClicks++;
  });
  await tickUntil(page, async () => await nextClicks(page) === 1);
  for (let i = 0; i < 3; i++) await step(page);
  expect(await nextClicks(page)).toBe(1);
});

test('changing to another course prevents further playback actions', async ({ page }) => {
  await page.evaluate(() => history.replaceState(null, '', '/courses/10'));
  expect((await step(page)).status).toBe('waiting_for_course');
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
  expect(await nextClicks(page)).toBe(0);
});

test('closing the curriculum cannot restart a paused video', async ({ page }) => {
  await step(page);
  await page.locator(mainSelector).evaluate(video => video.pause());
  await page.locator('.cv-curriculum-item').evaluate(item => item.remove());
  expect((await step(page)).status).toBe('waiting_for_curriculum');
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
});

test('a disabled Next button can be retried after it becomes enabled', async ({ page }) => {
  await page.locator('.cv-next-chapter-btn').evaluate(button => { button.disabled = true; });
  await step(page);
  await nativeEnd(page);
  expect((await step(page)).status).toBe('waiting_for_next_button');
  expect(await nextClicks(page)).toBe(0);
  await page.locator('.cv-next-chapter-btn').evaluate(button => { button.disabled = false; });
  expect((await step(page)).status).toBe('advanced');
  expect(await nextClicks(page)).toBe(1);
});

test('the final video finishes without restarting', async ({ page }) => {
  await page.locator('.cv-next-chapter-btn').evaluate(button => {
    button.remove();
    document.body.insertAdjacentHTML('beforeend', '<span class="cv-next-chapter-last">Last</span>');
  });
  await step(page);
  await nativeEnd(page);
  expect((await step(page)).status).toBe('finished');
  expect((await step(page)).status).toBe('finished');
  expect(await page.locator(mainSelector).evaluate(video => video.ended)).toBe(true);
  expect(await nextClicks(page)).toBe(0);
});

test('an unrelated covering element blocks Next until it is removed', async ({ page }) => {
  await step(page);
  await nativeEnd(page);
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div id="cover" style="position:fixed;inset:0;z-index:999"></div>'));
  expect((await step(page)).status).toBe('waiting_for_next_button');
  expect(await nextClicks(page)).toBe(0);
  await page.locator('#cover').evaluate(cover => cover.remove());
  expect((await step(page)).status).toBe('advanced');
  expect(await nextClicks(page)).toBe(1);
});

test('1.1.4 to 1.2 to 1.2.1 works after the grace period without fabricating completion', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('.cv-curriculum-item').remove();
    const tree = document.createElement('div');
    tree.dataset.chapterId = '1';
    tree.innerHTML = '<div data-node-id="11"><div data-node-id="114"><div class="cv-curriculum-item is-active"><span class="cv-curriculum-status-icon"></span><span class="cv-curriculum-item-title">1.1.4</span></div></div></div><div data-node-id="12"><div class="cv-curriculum-item"><span class="cv-curriculum-status-icon"></span><span class="cv-curriculum-item-title">1.2</span></div><div data-node-id="121"><div class="cv-curriculum-item"><span class="cv-curriculum-status-icon"></span><span class="cv-curriculum-item-title">1.2.1</span></div></div></div>';
    document.body.prepend(tree);
    const main = document.querySelector('.cv-video-player > video');
    main.onended = () => window.nativeEnds++;
    document.querySelector('.cv-next-chapter-btn').onclick = () => {
      window.nextClicks++;
      const items = [...tree.querySelectorAll('.cv-curriculum-item')];
      items.forEach(item => item.classList.remove('is-active'));
      items[window.nextClicks].classList.add('is-active');
      main.src = window.nextClicks === 1 ? secondClip : firstClip;
    };
  });
  await step(page);
  await nativeEnd(page);
  expect((await step(page)).status).toBe('waiting_for_recorded_completion');
  expect(await nextClicks(page)).toBe(0);
  await tickUntil(page, async () => await nextClicks(page) === 1);
  await expect(page.locator('.cv-curriculum-item.is-active')).toHaveText('1.2');
  expect(await page.evaluate(() => window.nativeEnds)).toBe(1);
  expect(await page.evaluate(() => window.__testController.status().recent_actions.at(-1).completion_recorded)).toBe(false);
  await expect(page.locator('.is-completed')).toHaveCount(0);
  await tickUntil(page, () => isPlaying(page));
  await tickUntil(page, async () => await nextClicks(page) === 2);
  await expect(page.locator('.cv-curriculum-item.is-active')).toHaveText('1.2.1');
  expect(await page.evaluate(() => window.nativeEnds)).toBe(2);
  await expect(page.locator('.is-completed')).toHaveCount(0);
});

test('the ended floating player is hidden for Next and the following player restored', async ({ page }) => {
  await page.evaluate(() => {
    window.hideClicks = 0;
    window.restoreClicks = 0;
    const player = document.querySelector('.cv-video-player');
    player.style.cssText = 'position:fixed;inset:0;z-index:10;background:white';
    player.insertAdjacentHTML('afterbegin', '<div class="cv-video-player-mobile-bar"><button>Hide video</button></div>');
    const restore = document.createElement('button');
    restore.className = 'cv-restore-floating';
    restore.textContent = 'Show video';
    restore.hidden = true;
    document.body.append(restore);
    player.querySelector('.cv-video-player-mobile-bar button').onclick = () => {
      window.hideClicks++;
      player.classList.add('is-collapsed');
      player.style.visibility = 'hidden';
      restore.hidden = false;
    };
    restore.onclick = () => {
      window.restoreClicks++;
      player.classList.remove('is-collapsed');
      player.style.visibility = 'visible';
      restore.hidden = true;
    };
  });
  await step(page);
  expect(await page.evaluate(() => window.hideClicks)).toBe(0);
  expect(await nextClicks(page)).toBe(0);
  await nativeEnd(page);
  expect((await step(page)).status).toBe('hiding_completed_video');
  expect(await page.evaluate(() => window.hideClicks)).toBe(1);
  expect(await nextClicks(page)).toBe(0);
  expect((await step(page)).status).toBe('advanced');
  await page.waitForFunction(() => document.querySelector('.cv-video-player > video').readyState >= 2);
  await page.locator(mainSelector).evaluate(video => video.play());
  expect((await step(page)).status).toBe('restoring_video');
  expect(await page.evaluate(() => window.restoreClicks)).toBe(1);
  await tickUntil(page, () => isPlaying(page));
  expect(await nextClicks(page)).toBe(1);
});

test('a supplement plays to its natural end then resumes the main lecture', async ({ page }) => {
  await step(page);
  await expect.poll(() => isPlaying(page)).toBe(true);
  await page.evaluate(() => {
    const main = document.querySelector('.cv-video-player > video');
    main.pause();
    main.parentElement.classList.add('is-gated');
    const overlay = document.createElement('div');
    overlay.className = 'cv-ix-popup-overlay';
    overlay.innerHTML = '<video class="cv-ix-popup-video" muted playsinline></video><div class="cv-ix-popup-intro"><button class="cv-ix-popup-intro-btn">Start watching</button></div>';
    document.body.append(overlay);
    const clip = overlay.querySelector('video');
    clip.src = firstClip;
    overlay.querySelector('button').onclick = () => {
      overlay.querySelector('.cv-ix-popup-intro').remove();
      clip.play();
    };
    clip.onended = () => {
      overlay.insertAdjacentHTML('beforeend', '<div class="cv-ix-popup-done">Returning to lesson</div>');
      setTimeout(() => {
        overlay.remove();
        main.parentElement.classList.remove('is-gated');
      }, 1000);
    };
  });
  await page.waitForFunction(() => document.querySelector('.cv-ix-popup-video').readyState >= 2);
  expect((await step(page)).status).toBe('supplement_started');
  await page.waitForFunction(() => document.querySelector('.cv-ix-popup-video').currentTime > 0);
  expect(await nextClicks(page)).toBe(0);
  await page.waitForFunction(() => document.querySelector('.cv-ix-popup-video').ended);
  expect((await step(page)).status).toBe('finishing_supplement');
  expect(await page.locator('.cv-ix-popup-video').evaluate(video => video.ended)).toBe(true);
  expect(await nextClicks(page)).toBe(0);
  await tickUntil(page, () => isPlaying(page));
  await tickUntil(page, async () => await nextClicks(page) === 1);
});

test('question Skip resumes without submitting or entering an answer', async ({ page }) => {
  await step(page);
  await addQuestion(page);
  expect((await step(page)).status).toBe('question_skipped');
  expect(await page.evaluate(() => window.skips)).toBe(1);
  expect(await page.evaluate(() => window.submissions)).toBe(0);
  await tickUntil(page, () => isPlaying(page));
});

test('the normal question outcome Continue button is clicked', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('.cv-video-player').classList.add('is-gated');
    window.continued = 0;
    const overlay = document.createElement('div');
    overlay.className = 'cv-ix-popup-overlay cv-ix-q-overlay';
    overlay.innerHTML = '<div class="cv-ix-q-outcome is-continue"><button class="cv-ix-q-outcome-btn">Continue lesson</button></div>';
    overlay.querySelector('button').onclick = () => {
      window.continued++;
      overlay.remove();
      document.querySelector('.cv-video-player').classList.remove('is-gated');
    };
    document.body.append(overlay);
  });
  expect((await step(page)).status).toBe('question_continued');
  expect(await page.evaluate(() => window.continued)).toBe(1);
});

test('the tutor above a supplement closes and the same clip resumes', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('.cv-video-player').classList.add('is-gated');
    const popup = document.createElement('div');
    popup.className = 'cv-ix-popup-overlay';
    popup.innerHTML = '<video class="cv-ix-popup-video" muted playsinline loop></video><div class="cv-video-player-controls"><div class="cv-video-controls-left"><button class="cv-video-control-btn">Play</button></div></div>';
    document.body.append(popup);
    const clip = popup.querySelector('video');
    clip.src = firstClip;
    popup.querySelector('button').onclick = () => clip.paused ? clip.play() : clip.pause();
  });
  await page.waitForFunction(() => document.querySelector('.cv-ix-popup-video').readyState >= 2);
  expect((await step(page)).status).toBe('supplement_started');
  await page.waitForFunction(() => !document.querySelector('.cv-ix-popup-video').paused);
  await page.evaluate(() => {
    document.querySelector('.cv-ix-popup-video').pause();
    window.tutorCloses = 0;
    const tutor = document.createElement('div');
    tutor.className = 'cv-ix-popup-overlay cv-ix-q-overlay cv-tutor-ov';
    tutor.style.cssText = 'position:fixed;inset:0;z-index:100;background:white';
    tutor.innerHTML = '<button class="cv-tutor-ov-back">Return to lesson</button>';
    tutor.querySelector('button').onclick = () => { window.tutorCloses++; tutor.remove(); };
    document.body.append(tutor);
  });
  expect((await step(page)).status).toBe('tutor_closed');
  expect(await page.evaluate(() => window.tutorCloses)).toBe(1);
  expect((await step(page)).status).toBe('supplement_started');
  await page.waitForFunction(() => !document.querySelector('.cv-ix-popup-video').paused);
  expect(await nextClicks(page)).toBe(0);
});

test('numeric courses beyond the original course 9 work', async ({ page }) => {
  await page.evaluate(() => {
    window.__testController.destroy();
    history.replaceState(null, '', '/courses/42');
    window.__testController = window.VideoAutomationAgent.createController();
  });
  await step(page);
  await expect.poll(() => isPlaying(page)).toBe(true);
  await tickUntil(page, async () => await nextClicks(page) === 1);
});

test('interaction skipping can be disabled', async ({ page }) => {
  await page.evaluate(() => {
    window.__testController.destroy();
    window.__testController = window.VideoAutomationAgent.createController({ skipInteractions: false });
  });
  await addQuestion(page);
  expect((await step(page)).status).toBe('waiting_for_interaction');
  expect(await page.evaluate(() => window.skips)).toBe(0);
  expect(await page.evaluate(() => window.submissions)).toBe(0);
  await expect(page.locator('input')).toHaveValue('');
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
});

test('duplicate Start schedules one timer and Stop prevents further navigation', async ({ page }) => {
  await page.evaluate(() => {
    const original = window.setInterval.bind(window);
    window.scheduledIntervals = 0;
    window.setInterval = (...args) => { window.scheduledIntervals++; return original(...args); };
    window.__testController.start();
    window.__testController.start();
  });
  await expect.poll(() => isPlaying(page)).toBe(true);
  expect(await page.evaluate(() => window.scheduledIntervals)).toBe(1);
  await page.evaluate(() => window.__testController.stop());
  expect(await page.evaluate(() => window.__testController.status().running)).toBe(false);
  await nativeEnd(page);
  await page.waitForTimeout(1200);
  expect(await nextClicks(page)).toBe(0);
});

test('leaving the selected course stops an active controller', async ({ page }) => {
  await page.evaluate(() => {
    window.__testController.start();
    document.querySelector('.cv-video-player > video').pause();
    history.replaceState(null, '', '/courses/10');
  });
  await expect.poll(() => page.evaluate(() => window.__testController.status().running)).toBe(false);
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
  expect(await nextClicks(page)).toBe(0);
});

test('unsupported hosts, protocols and nonnumeric paths cannot create a controller', async ({ page }) => {
  const results = await page.evaluate(() => [
    'https://example.com/courses/9',
    'http://tutor-t.thinkforbl.com/courses/9',
    'https://tutor-t.thinkforbl.com/courses/example',
    'https://tutor-t.thinkforbl.com/courses/9/other',
  ].map(courseUrl => {
    try { window.VideoAutomationAgent.createController({ courseUrl }); return false; }
    catch { return true; }
  }));
  expect(results).toEqual([true, true, true, true]);
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
});

test('invalid run durations cannot start playback', async ({ page }) => {
  const results = await page.evaluate(() => [0, -1, NaN, Infinity, 25, '12'].map(hours => {
    try { window.__testController.start(hours); return false; }
    catch { return true; }
  }));
  expect(results).toEqual([true, true, true, true, true, true]);
  expect(await page.evaluate(() => window.__testController.status().running)).toBe(false);
  expect(await page.locator(mainSelector).evaluate(video => video.paused)).toBe(true);
});
