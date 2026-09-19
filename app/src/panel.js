/* Video Automation Agent — MIT. All controls and state remain in this tab. */
(() => {
  'use strict';
  if (window.top !== window || location.origin !== 'https://tutor-t.thinkforbl.com'
    || !/^\/courses\/\d+\/?$/.test(location.pathname) || document.getElementById('vaa-panel')) return;

  const host = document.createElement('div');
  host.id = 'vaa-panel';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; position: fixed; top: 12px; left: 12px; z-index: 2147483647;
        width: 304px; max-width: calc(100vw - 24px); color-scheme: light;
        font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.45; color: #17243a; }
      * { box-sizing: border-box; }
      section { background: #fff; border: 1px solid #ccd5e3; border-radius: 12px;
        box-shadow: 0 5px 22px #14213d24; padding: 14px; }
      h2 { font: 700 14px/1.4 system-ui, sans-serif; margin: 0 0 8px; }
      p { margin: 6px 0; overflow-wrap: anywhere; }
      .status { font-weight: 600; }
      .detail, .note { font-size: 11px; color: #536177; }
      .error { color: #a31c27; font-size: 12px; }
      .error:empty, .detail:empty { display: none; }
      label { display: block; margin: 8px 0; }
      input[type="checkbox"] { accent-color: #205dcc; vertical-align: middle; margin: 0 5px 0 0; }
      input[type="number"] { font: inherit; width: 62px; padding: 4px; margin-left: 5px;
        color: #17243a; background: #fff; border: 1px solid #96a6bd; border-radius: 4px; }
      .buttons { display: flex; gap: 8px; margin-top: 10px; }
      button { flex: 1; border: 1px solid #96a6bd; border-radius: 6px; padding: 8px 10px;
        font: 600 13px/1.2 system-ui, sans-serif; background: #f3f6fb; color: #17243a; cursor: pointer; }
      button[type="submit"] { background: #205dcc; border-color: #205dcc; color: #fff; }
      button:disabled { opacity: .5; cursor: default; }
      button:focus-visible, input:focus-visible { outline: 3px solid #eba52c; outline-offset: 2px; }
      @media (max-width: 480px) { :host { width: 274px; } section { padding: 10px; } }
    </style>
    <section aria-label="영상 자동화 / Video Automation Agent">
      <h2>영상 자동화 / Video Automation Agent</h2>
      <p class="status" role="status" aria-live="polite"></p>
      <p class="detail"></p>
      <form novalidate>
        <label><input type="checkbox" name="skip" checked>질문 건너뛰기 / Skip questions</label>
        <label><input type="checkbox" name="goal" checked>100%까지 실행 / Until 100%</label>
        <label>최대 실행 시간 / Maximum hours<input type="number" name="hours" value="12" min="0.01" max="24" step="any"></label>
        <p class="error" role="alert"></p>
        <div class="buttons">
          <button type="submit">시작 / Start</button>
          <button type="button" name="stop" disabled>정지 / Stop</button>
        </div>
      </form>
      <p class="note">정지는 자동 클릭만 멈춥니다. / Stop ends automation; the video keeps its current state.</p>
    </section>`;
  document.documentElement.appendChild(host);

  const statusNode = shadow.querySelector('.status');
  const detailNode = shadow.querySelector('.detail');
  const errorNode = shadow.querySelector('.error');
  const hoursInput = shadow.querySelector('[name="hours"]');
  const skipInput = shadow.querySelector('[name="skip"]');
  const goalInput = shadow.querySelector('[name="goal"]');
  const startButton = shadow.querySelector('[type="submit"]');
  const stopButton = shadow.querySelector('[name="stop"]');
  let controller = null;
  const messages = {
    not_started: '준비됨 — 시작을 눌러 주세요. / Ready — press Start.',
    stopped: '정지됨 / Automation stopped.',
    starting: '강의 재생 시작 / Starting the lesson.',
    playing: '강의 재생 중 / Playing the lesson.',
    paused: '일시정지 — 영상에서 직접 재생하세요. / Paused — resume in the player.',
    buffering: '영상 불러오는 중 / Buffering video.',
    restoring_video: '영상 창 여는 중 / Restoring the player.',
    video_hidden: '영상 창을 직접 열어 주세요. / Open the video player.',
    waiting_for_video: '로그인 후 강의 영상을 열어 주세요. / Log in and open a lesson video.',
    ambiguous_video: '영상이 여러 개입니다. 하나만 열어 주세요. / Open one lesson video.',
    waiting_for_curriculum: '커리큘럼 목록을 열어 주세요. / Open the curriculum sidebar.',
    waiting_for_play_control: '영상에서 재생을 직접 눌러 주세요. / Press Play in the video.',
    waiting_for_interaction: '화면의 질문·안내를 직접 처리해 주세요. / Complete the on-screen interaction.',
    waiting_for_course: '선택한 강의를 벗어났습니다. / Left the selected course.',
    waiting_for_recorded_completion: '영상 종료 — 다음 강의 준비 중 / Video ended — preparing the next lesson.',
    waiting_for_next_button: '다음 버튼이 보이거나 활성화될 때까지 대기 / Waiting for a visible, enabled Next button.',
    waiting_for_next: '다음 강의 불러오는 중 / Loading the next lesson.',
    next_navigation_stalled: '이동이 지연됩니다. 다음 버튼을 확인해 주세요. / Navigation stalled — check the Next button.',
    advanced: '다음 강의로 이동 / Opened the next lesson.',
    hiding_completed_video: '종료된 영상 창 숨기는 중 / Hiding the ended player.',
    supplement_started: '보충영상 시작 / Starting the supplementary video.',
    supplement_playing: '보충영상 재생 중 / Playing the supplementary video.',
    supplement_buffering: '보충영상 불러오는 중 / Buffering the supplementary video.',
    supplement_paused: '보충영상 일시정지 — 직접 재생하세요. / Supplement paused — resume in its player.',
    finishing_supplement: '보충영상 종료 — 본 강의 복귀 대기 / Supplement ended — waiting to return.',
    supplement_skipped: '제공된 건너뛰기 버튼 처리 / Used the available supplement Skip button.',
    question_skipped: '질문 건너뛰기 완료 / Used the question Skip button.',
    question_continued: '계속 버튼 처리 / Used the Continue button.',
    tutor_closed: '튜터에서 영상으로 복귀 / Returned from the tutor.',
    video_error: '영상 오류 — 사이트 플레이어를 확인해 주세요. / Video error — check the site player.',
    supplement_error: '보충영상 오류 — 사이트 플레이어를 확인해 주세요. / Supplement error — check the site player.',
    script_error: '자동화 오류 — 새로고침 후 다시 시작하세요. / Automation error — reload and press Start.',
    time_limit_reached: '설정한 실행 시간 종료 / Run duration reached.',
    finished: '마지막 영상 재생 종료 / Reached the final video.',
    course_completed: '사이트 학습완료율 100% — 자동화 정지 / Site progress reached 100% — automation stopped.',
    replaying_incomplete: '미완료 영상 다시 재생 / Replaying an incomplete lesson.',
    revisiting_incomplete: '미완료 강의로 이동 / Returning to an incomplete lesson.',
    expanding_curriculum: '커리큘럼 목록 펼치는 중 / Expanding the curriculum.',
    waiting_for_course_completion: '사이트 완료율 갱신 대기 / Waiting for the site to update completion.',
    waiting_for_progress: '학습완료율을 확인하려면 커리큘럼을 열어 주세요. / Open the curriculum to read course progress.',
  };
  function render() {
    const state = controller ? controller.status() : { status: 'not_started', running: false };
    const message = messages[state.status] || `상태 확인 필요 / Check the player (${state.status}).`;
    if (statusNode.textContent !== message) statusNode.textContent = message;
    const progress = Number.isFinite(state.course_progress) ? `학습완료율 / Course progress: ${state.course_progress}%` : '';
    const detail = [progress, state.lesson].filter(Boolean).join(' · ');
    if (detailNode.textContent !== detail) detailNode.textContent = detail;
    startButton.disabled = !!state.running;
    stopButton.disabled = !state.running;
    hoursInput.disabled = !!state.running || goalInput.checked;
    skipInput.disabled = !!state.running;
    goalInput.disabled = !!state.running;
  }
  shadow.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const hours = goalInput.checked ? 12 : Number(hoursInput.value);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      errorNode.textContent = '0보다 크고 24 이하인 시간을 입력하세요. / Enter hours greater than 0 and up to 24.';
      hoursInput.focus();
      return;
    }
    try {
      if (controller?.status().running) return;
      controller?.destroy();
      controller = window.VideoAutomationAgent.createController({
        courseUrl: location.href, skipInteractions: skipInput.checked, untilComplete: goalInput.checked,
      });
      window.__videoAutomationAgent = controller;
      controller.start(hours);
      errorNode.textContent = '';
    } catch {
      controller?.stop();
      errorNode.textContent = 'Tutor-T 강의 페이지를 새로고침하고 다시 시작하세요. / Reload a Tutor-T course page and press Start again.';
    }
    render();
  });
  stopButton.addEventListener('click', () => {
    controller?.stop();
    render();
  });
  goalInput.addEventListener('change', render);
  render();
  const displayTimer = setInterval(() => {
    if (!host.isConnected) {
      controller?.destroy();
      clearInterval(displayTimer);
      return;
    }
    render();
  }, 1000);
})();
