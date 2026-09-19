# Video Automation Agent design

## Outcome

Publish the existing Tutor-T playback automation as a reusable browser tool in
`LSB-afk/Video-Automation-Agent`. A user can install a release, log in themselves,
open a course, and start or stop automation without Python, an LLM key, or Aside.

## Scope and decisions

- Support Tutor-T courses at `https://tutor-t.thinkforbl.com/courses/<number>`.
  Browser portability does not imply support for every learning platform.
- Ship a userscript for browsers with compatible userscript managers and unpacked
  Chromium/Firefox extension distributions. Safari uses a compatible userscript
  manager; store signing and native mobile background playback are outside scope.
- Prefer browser-local execution over a remote debugging service or a hosted agent:
  the user keeps their own logged-in session, and no credentials leave the browser.
- Preserve the tested existing behavior: real main/supplement playback, normal
  Skip/Continue/Return buttons, natural-end navigation across topics, hiding an
  ended floating player that covers Next, and restoring the next player.
- Never seek forward, change playback speed, synthesize completion events, call
  completion APIs, write answers, or change the site's completion records.
- Missing completion checkmarks permit normal Next navigation after a 3-second
  grace period. Record the original completion value honestly.
- Start only on user action. Provide a visible status panel, interaction-skip
  setting, a default "until 100%" goal, optional bounded duration, and Stop.
  Manual pauses remain respected.
- Read only the site's curriculum completion percentage. In goal mode, stop only
  when its displayed and precise progress reach 100%; last-video end is not success.
  After the first pass, expand curriculum sections and replay items the site still
  marks incomplete using ordinary UI. Keep waiting if progress is unavailable or
  if no actionable incomplete item exists. Never manufacture completion.
- Refresh requires Start again. Navigation outside the selected course stops
  further actions. Duplicate injection must not duplicate panels or timers.
- Do not include local paths, browser profiles, account identifiers, cookies,
  cached site bundles, or runtime state in the public repository.

## Structure and contract

- `app/src/controller.js`: dependency-free browser controller migrated from the
  existing verified Aside script. Exposes `window.VideoAutomationAgent` with
  `createController({courseUrl, skipInteractions, untilComplete})`. The API defaults
  `untilComplete` to false for bounded callers; the panel defaults it to true.
  `courseUrl` defaults to the
  current page; only the supported HTTPS host and numeric course path are valid.
- A controller exposes `start(hours = 12)`, `stop()`, `step()`, `status()` and
  `destroy()`. `start` validates finite hours in `(0, 24]`, is idempotent while
  running, and schedules one tick per second. `destroy` stops its timer.
  Goal mode has no duration deadline; explicit Stop and leaving the course still stop it.
- `app/src/panel.js`: browser-local UI; stores its controller as
  `window.__videoAutomationAgent`; uses Shadow DOM to avoid site style collisions.
  Mount only on supported course pages, using a stable `vaa-panel` host ID.
- `app/scripts/build.mjs`: compose the same controller and panel into a userscript
  and browser extension folders. Release ZIPs must contain a root manifest.
- `app/tests/`: real media fixtures and Playwright behavior tests in Chromium,
  Firefox, and WebKit; artifact/packaging tests run through Node's test runner.
- `skills/video-automation-agent/SKILL.md`: portable assistant instructions for
  this repository, without relying on a particular user's Python path or account.
- `README.md`, `docs/README.en.md`, compatibility/troubleshooting/contributing
  documents, MIT license, CI, and release artifacts.

## Acceptance

1. Regressions from the existing tool remain covered with real media playback.
2. Any numeric course works, but unrelated origins and courses are untouched.
3. Native end precedes Next, and missing completion cannot cause indefinite wait.
4. Topic transitions, supplemental playback, user pause/stop, duplicate starts,
   stale/covered/disabled buttons, and unsupported pages are tested.
5. Fresh checkout installs with `npm ci`, builds offline after installation, and
   passes automated tests. There are no runtime package dependencies.
6. Test engine coverage is stated accurately: WebKit is not branded Safari proof,
   and untested browser brands/managers are not described as verified.
7. Source, docs, reproducible packages, and CI are pushed to the requested repo.

## Operational limits

The browser must remain open and the device awake. Autoplay policy, site changes,
network failures, and unknown interactions can require user action. A completed
playback traversal does not establish certified course completion.
