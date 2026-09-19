/* Video Automation Agent — MIT. Browser-local Tutor-T adapter.
 * Migrated from the real-media-tested Aside controller; no runtime dependencies.
 */
(() => {
  'use strict';
  const version = '0.1.0';
  function createController({ courseUrl = location.href, skipInteractions = true, untilComplete = false } = {}) {
    let scope;
    try { scope = new URL(courseUrl); }
    catch { throw new Error('Invalid course URL'); }
    if (scope.origin !== 'https://tutor-t.thinkforbl.com' || !/^\/courses\/\d+\/?$/.test(scope.pathname)) {
      throw new Error('Open a supported Tutor-T course URL first');
    }
    if (typeof skipInteractions !== 'boolean') throw new Error('skipInteractions must be a boolean');
    if (typeof untilComplete !== 'boolean') throw new Error('untilComplete must be a boolean');
    let timer = null, active = false, deadline = 0;
    let startedKey = null, advancedKey = null, advancedAt = 0;
    let observedVideo = null;
    let endedKey = null, endedAt = 0;
    let textKey = null, textSeenAt = 0;
    let reviewing = false;
    const reviewed = new Set();
    let supplementStarted = new WeakSet();
    let latest = { status: 'not_started', running: false };
    const actions = [];
    const actionStates = new Set(['starting', 'advanced', 'hiding_completed_video', 'supplement_started', 'supplement_skipped', 'question_skipped', 'question_continued', 'tutor_closed', 'replaying_incomplete', 'revisiting_incomplete', 'expanding_curriculum', 'course_completed']);
    const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const record = (status, data = {}) => {
      const now = new Date().toISOString();
      if (actionStates.has(status) && (latest.status !== status || latest.lesson !== data.lesson)) {
        actions.push({ action: status, lesson: data.lesson, at: now,
          ...(status === 'advanced' ? { completion_recorded: data.completed } : {}) });
        if (actions.length > 8) actions.shift();
      }
      latest = { status, ...data, running: active, updated_at: now, recent_actions: actions.slice() };
      return { ...latest };
    };
    const canClick = element => {
      if (!visible(element) || element.disabled) return false;
      element.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    };
    function courseProgress() {
      const box = document.querySelector('.cv-curriculum-progress');
      const parse = text => {
        const match = String(text || '').trim().match(/^(\d+(?:\.\d+)?)%$/);
        const value = match ? Number(match[1]) : NaN;
        return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      };
      const displayed = parse(box?.querySelector('.cv-curriculum-progress-value')?.textContent);
      const fill = box?.querySelector('.cv-curriculum-progress-fill');
      const precise = fill ? parse(fill.style.width) : displayed;
      return { value: displayed === null ? null : precise,
        complete: displayed === 100 && precise === 100 };
    }
    function hideCoveringPlayer(element, player) {
      if (!player || !visible(element) || element.disabled) return false;
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (hit?.closest('.cv-video-player') !== player) return false;
      const hide = player.querySelector(':scope > .cv-video-player-mobile-bar > button');
      if (!canClick(hide)) return false;
      hide.click();
      return true;
    }
    const itemIdentity = item => JSON.stringify([
      item.closest('[data-chapter-id]')?.getAttribute('data-chapter-id'),
      item.closest('[data-node-id]')?.getAttribute('data-node-id'),
      item.querySelector('.cv-curriculum-item-title')?.textContent.trim(),
    ]);
    function reviewIncomplete(item, video, player, key, report) {
      const collapsed = document.querySelector('.cv-curriculum-chapter:not(.is-open) .cv-curriculum-chapter-toggle');
      if (collapsed) {
        if (!canClick(collapsed)) {
          if (hideCoveringPlayer(collapsed, player)) return report('hiding_completed_video');
          return report('waiting_for_curriculum');
        }
        collapsed.click();
        return report('expanding_curriculum');
      }
      const missing = [...document.querySelectorAll('.cv-curriculum-item')].filter(entry =>
        entry.querySelector('.cv-curriculum-status-icon') && !entry.querySelector('.cv-curriculum-status-icon.is-completed'));
      if (!missing.length) return report('waiting_for_course_completion');
      reviewed.add(itemIdentity(item));
      let candidate = missing.find(entry => !reviewed.has(itemIdentity(entry)));
      if (!candidate) { reviewed.clear(); candidate = missing[0]; }
      if (candidate === item) {
        if (player.classList.contains('is-collapsed')) {
          const restore = document.querySelector('button.cv-restore-floating');
          if (!canClick(restore)) return report('video_hidden');
          restore.click();
          return report('restoring_video');
        }
        const play = player.querySelector(':scope > .cv-video-player-controls .cv-video-controls-left > button.cv-video-control-btn');
        if (!play || play.disabled) return report('waiting_for_play_control');
        // A normal Play click on a naturally ended video replays it. The site
        // owns resetting its media and recording real watched intervals.
        startedKey = key;
        endedKey = null;
        play.click();
        return report('replaying_incomplete');
      }
      if (!canClick(candidate)) {
        if (hideCoveringPlayer(candidate, player)) return report('hiding_completed_video');
        return report('waiting_for_curriculum');
      }
      advancedKey = key;
      advancedAt = Date.now();
      candidate.click();
      return report('revisiting_incomplete');
    }
    function step() {
      if (location.origin !== scope.origin || location.pathname.replace(/\/$/, '') !== scope.pathname.replace(/\/$/, '')) {
        stop();
        return record('waiting_for_course');
      }
      const item = document.querySelector('.cv-curriculum-item.is-active');
      const videos = [...document.querySelectorAll('.cv-video-player > video')].filter(v => !v.srcObject);
      const video = videos.length === 1 ? videos[0] : null;
      const player = video?.parentElement;
      // A site rerender can replace a paused media element without changing
      // the lesson or source. A click on the detached element did not start
      // this new one; manual pauses still belong to the same element.
      if (video && video !== observedVideo) {
        observedVideo = video;
        startedKey = null;
      }
      const progress = courseProgress();
      const data = {
        lesson: item?.querySelector('.cv-curriculum-item-title')?.textContent.trim() || '',
        current: video?.currentTime || 0,
        duration: Number.isFinite(video?.duration) ? video.duration : null,
        completed: !!item?.querySelector('.cv-curriculum-status-icon.is-completed'),
        course_progress: progress.value,
        until_complete: untilComplete,
      };
      const report = state => record(state, data);
      if (untilComplete && progress.complete) {
        stop();
        return report('course_completed');
      }
      if (player?.classList.contains('is-gated') ||
        [...document.querySelectorAll('.cv-ix-q-standby,.cv-ix-popup-overlay,.cv-tutor-modal-overlay,[role=dialog],[aria-modal=true]')].some(visible)) {
        // These overlays pause the main video themselves. Resume it after the
        // site's normal interaction flow closes, even when it was already seen.
        startedKey = null;
        const tutorBack = document.querySelector('.cv-tutor-ov .cv-tutor-ov-back');
        if (canClick(tutorBack)) {
          // The tutor can cover an existing supplementary video and pause it.
          // Close the top overlay first, then allow that same clip to resume.
          for (const clip of document.querySelectorAll('video.cv-ix-popup-video')) {
            supplementStarted.delete(clip);
          }
          tutorBack.click();
          return report('tutor_closed');
        }
        const outcome = document.querySelector('.cv-ix-q-outcome .cv-ix-q-outcome-btn');
        if (canClick(outcome)) {
          outcome.click();
          return report('question_continued');
        }
        const questionSkip = [...document.querySelectorAll('.cv-ix-q-standby .cv-ix-q-standby-skip,.cv-ix-q-overlay:not(.cv-tutor-ov) .cv-ix-q-skip')].find(canClick);
        if (questionSkip && skipInteractions) {
          questionSkip.click();
          return report('question_skipped');
        }
        const popup = [...document.querySelectorAll('.cv-ix-popup-overlay:not(.cv-ix-q-overlay)')].find(visible);
        if (popup) {
          const clip = popup.querySelector('video.cv-ix-popup-video');
          if (clip) {
            data.supplement_current = clip.currentTime;
            data.supplement_duration = Number.isFinite(clip.duration) ? clip.duration : null;
            if (clip.error) return report('supplement_error');
            // The website closes this overlay three seconds after native ended.
            // Its done message is not a button; toggling play would restart it.
            if (clip.ended) return report('finishing_supplement');
          }
          const skip = [...popup.querySelectorAll('.cv-ix-q-standby-skip,.cv-ix-q-skip')].find(canClick);
          if (skip && skipInteractions) {
            skip.click();
            return report('supplement_skipped');
          }
          const intro = popup.querySelector('.cv-ix-popup-intro-btn');
          if (canClick(intro)) {
            intro.click();
            if (clip) supplementStarted.add(clip);
            return report('supplement_started');
          }
          if (clip && !clip.paused) return report('supplement_playing');
          if (clip && clip.readyState < 2) return report('supplement_buffering');
          if (clip && !supplementStarted.has(clip)) {
            const play = popup.querySelector(':scope > .cv-video-player-controls .cv-video-controls-left > button.cv-video-control-btn') || popup.querySelector('.cv-video-player-play-btn[aria-label="Play"]');
            if (play && !play.disabled) {
              play.click();
              supplementStarted.add(clip);
              return report('supplement_started');
            }
          }
          return report(clip ? 'supplement_paused' : 'waiting_for_interaction');
        }
        return report('waiting_for_interaction');
      }
      const key = JSON.stringify([item ? itemIdentity(item) : null, video?.getAttribute('src')]);
      if (key === advancedKey) return report(Date.now() - advancedAt < 30000 ? 'waiting_for_next' : 'next_navigation_stalled');
      if (!video) {
        if (videos.length) return report('ambiguous_video');
        // A text-only entry can become complete through the site's own normal
        // viewing flow. Allow it to continue after a load-settling interval;
        // unknown incomplete entries must not be marked read by this tool.
        if (untilComplete && item && data.completed) {
          if (textKey !== key) { textKey = key; textSeenAt = Date.now(); }
          if (Date.now() - textSeenAt < 3000) return report('waiting_for_video');
          if (reviewing || document.querySelector('.cv-next-chapter-last')) {
            reviewing = true;
            if (progress.value === null) return report('waiting_for_progress');
            return reviewIncomplete(item, null, null, key, report);
          }
          const next = document.querySelector('.cv-next-chapter-btn');
          if (!canClick(next)) return report('waiting_for_next_button');
          advancedKey = key;
          advancedAt = Date.now();
          next.click();
          return report('advanced');
        }
        textKey = null;
        return report('waiting_for_video');
      }
      textKey = null;
      if (!item) return report('waiting_for_curriculum');
      if (video.error) return report('video_error');
      if (video.ended && !video.seeking) {
        if (!data.duration || Math.abs(data.current - data.duration) > 0.5) return report('waiting_for_video');
        if (endedKey !== key) {
          endedKey = key;
          endedAt = Date.now();
        }
        // Give the site's progress save time to finish. Its enabled Next button
        // also supports 1.1.4 -> 1.2 -> 1.2.1 without a completion checkmark.
        // Keep the reported completion value unchanged if the save never appears.
        if (!data.completed && Date.now() - endedAt < 3000) return report('waiting_for_recorded_completion');
        if (untilComplete && (reviewing || document.querySelector('.cv-next-chapter-last'))) {
          reviewing = true;
          if (progress.value === null) return report('waiting_for_progress');
          return reviewIncomplete(item, video, player, key, report);
        }
        if (document.querySelector('.cv-next-chapter-last')) {
          stop();
          return report('finished');
        }
        const next = document.querySelector('.cv-next-chapter-btn');
        if (!canClick(next)) {
          if (hideCoveringPlayer(next, player)) return report('hiding_completed_video');
          return report('waiting_for_next_button');
        }
        advancedKey = key;
        advancedAt = Date.now();
        next.click();
        return report('advanced');
      }
      endedKey = null;
      if (video.readyState < 2) return report('buffering');
      if (startedKey !== key && player.classList.contains('is-collapsed')) {
        const restore = document.querySelector('button.cv-restore-floating');
        if (!canClick(restore)) return report('video_hidden');
        restore.click();
        return report('restoring_video');
      }
      if (video.paused) {
        if (startedKey === key) return report('paused');
        const control = player.querySelector(':scope > .cv-video-player-controls .cv-video-controls-left > button.cv-video-control-btn');
        if (!control || control.disabled) return report('waiting_for_play_control');
        startedKey = key;
        control.click();
        return report('starting');
      }
      startedKey = key;
      return report('playing');
    }
    function stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
      active = false;
      return record('stopped');
    }
    function safeStep() {
      try {
        if (Date.now() >= deadline) {
          stop();
          return record('time_limit_reached');
        }
        return step();
      } catch (error) {
        stop();
        return record('script_error', { error_type: error.name });
      }
    }
    function start(hours = 12) {
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('hours must be in (0, 24]');
      if (active) return { ...latest };
      active = true;
      startedKey = null;
      observedVideo = null;
      advancedKey = null;
      endedKey = null;
      reviewing = false;
      textKey = null;
      reviewed.clear();
      supplementStarted = new WeakSet();
      deadline = untilComplete ? Infinity : Date.now() + hours * 3600000;
      timer = setInterval(safeStep, 1000);
      return safeStep();
    }
    return { version, start, stop, step, destroy: stop, status: () => ({ ...latest, running: active }) };
  }
  window.VideoAutomationAgent = { version, createController };
})();
