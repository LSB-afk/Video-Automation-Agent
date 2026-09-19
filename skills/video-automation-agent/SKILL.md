---
name: video-automation-agent
description: Use when a user asks to install, start, check, or stop the Video Automation Agent for Tutor-T, including “내 환경에 영상 자동화 에이전트를 설치하고 실행해줘”, “영상 자동화 시작해줘”, or “영상 자동화 멈춰줘”.
---

# Video Automation Agent

Source: https://github.com/LSB-afk/Video-Automation-Agent
Supported course URLs: `https://tutor-t.thinkforbl.com/courses/<numeric-id>`.
The playback controller runs in the user's authenticated browser without an LLM
API key. Codex or Hermes interprets the request and manages installation/start.

## One-sentence installation and start

Treat “내 환경에 영상 자동화 에이전트를 설치하고 실행해줘” as authorization
to prepare this tool and start goal mode on the user's selected/open course.
Use existing context; do not ask the user to repeat the repository URL or manually
run routine setup commands. Announce that this skill is being used.

1. Locate this installed `SKILL.md`; resolve `scripts/bootstrap.mjs` **relative to
   this skill directory**, not the current working directory. Quote paths.
   Node.js 22+ is required for this launcher, Git only for an initial download.
   Check available versions and, if missing, use the environment's supported
   installation method. Report a concrete blocker if installation is unavailable.
2. Run `node "<skill-dir>/scripts/bootstrap.mjs" prepare`.
   This finds the installer's local `workspace.json`, the repository containing
   the skill, or a cached checkout; otherwise it clones the source above into
   `$XDG_DATA_HOME/video-automation-agent/workspace` (default
   `~/.local/share/video-automation-agent/workspace`). It never auto-pulls or
   replaces an existing unrelated directory. `--workspace "<checkout>"` or
   `VAA_WORKSPACE` explicitly selects a moved/custom checkout. Preparation is
   **not** proof of browser installation or playback. Runtime npm packages are
   unnecessary; do not install Playwright just to play videos.
3. Connect to the browser the user is actually using:
   - **Aside:** when its official CLI is available and the user is using Aside,
     run `node "<skill-dir>/scripts/bootstrap.mjs" start`. The CLI reuses the
     logged-in course tab, starts until genuine 100%, and returns an existing
     running controller unchanged. Append `--url <course-url>` when the target
     is known. If multiple courses remain ambiguous, ask only which course.
     If its CLI is missing, consult https://docs.aside.com/help/developers for
     installation; never assume Aside is installed on another person's machine.
   - **Other browsers:** use an available authorized browser connection to the
     user's existing course tab. If the automation panel exists, read its state
     and use its normal Start button with **Until 100%** checked. If absent and
     script evaluation is supported, inspect for an active public/legacy helper
     first, then inject the `controller` and `panel` files returned by `prepare`,
     in that order, and click Start. Do not inject another instance over an
     active helper. Accessible globals are `window.__videoAutomationAgent` and
     the older `window.__tutorPlayback`; inspect their `status()?.running`.
     A page-script injection lasts only for the current page.
     For persistent installation, use the checkout's `README.md` and
     `docs/compatibility.md` for the release userscript/extension and required
     browser approvals. A browser with no authorized control connection may
     require the user to install/enable the script and press Start. Report this
     boundary; do not switch them silently to Aside or claim playback started.
4. Read status after starting and again after a few seconds. Increasing current
   time, supplemental playback, or an observed normal lesson transition proves
   activity. Report the lesson, site's progress, and actual running/waiting state.
   In Aside use `node "<skill-dir>/scripts/bootstrap.mjs" status`. In other
   browsers read the visible panel (extension isolated worlds may hide the
   controller from page evaluation). When accessible, the controller status is
   `window.__videoAutomationAgent?.status()`.
5. Leave the browser-local controller running until genuine 100%; the assistant
   need not keep a chat turn open for the entire course. Keep the browser open
   and device awake. Explain required login/permissions or unknown gates only
   when encountered. Do not claim that merely installing a skill installs a
   browser extension, Hermes itself, or an LLM connection.

## Status, stop, and repeat requests

- “영상 자동화 상태 알려줘”: inspect existing state. In Aside run the launcher's
  `status`; do not call `prepare` first just to inspect status.
- “영상 자동화 멈춰줘”: in Aside run the launcher's `stop`; elsewhere use the
  existing panel's Stop or the accessible controller's `stop()`, then verify.
  Do not clone, install, or start anything for a status/stop request. If the
  launcher reports `not_installed`, inspect any existing browser panel instead.
  In Aside without a checkout, its `repl` supports `listBrowserTabs()` and
  `attachBrowserTab(targetId)`. Select the known/unique supported course, attach
  that tab, and use `page.evaluate()` to read or stop its existing
  `window.__videoAutomationAgent`. Do not create a controller or stop an
  unrelated tab. An absent global is not proof that an isolated extension has
  stopped; check its visible panel when present.
- Repeated start must preserve an active controller and its current settings.
  To change an active run's settings, stop and restart that controller explicitly.
- Stop ends automation without pausing the current video. Refresh requires Start
  again. Never run this and an older helper simultaneously in the same tab.
- Credentials stay in the browser. Ask for login when needed; do not extract
  credentials or read another browser's profile.

## Behavior

- Real main and supplemental videos play through their normal controls.
- Provided Skip/Continue/Return controls are handled according to the visible
  preference; no answers are written or submitted.
- Main video must naturally end before Next. A missing completion checkmark gets
  a 3-second grace period, then normal Next navigation can proceed.
- The site's order includes `1.1.4 → 1.2 → 1.2.1` and chapter boundaries.
- A finished floating player covering Next is hidden; the next player is restored.
- Goal mode reads `.cv-curriculum-progress-value` and the precise curriculum bar.
  Only genuine 100% ends the run as `course_completed`. Rounded 100 with a 99.9
  bar, the last video, or all visible checkmarks alone cannot establish success.
- Below 100% after the last lesson, open collapsed curriculum chapters and replay
  entries still marked incomplete using normal UI. Rotate through missing entries
  so a delayed checkmark does not keep every other missing lesson waiting.
- Text-only entries already marked complete by the site continue after a
  three-second loading grace period. Incomplete unknown entries wait for the user.
- When no actionable missing entry exists or progress is unavailable, keep a
  truthful waiting state. Required user input, site errors, sleep, or closed tabs
  can prevent progress; do not manufacture completion to meet the goal.
- Manual pauses, unsupported pages, unknown dialogs, and disabled controls remain
  explicit waiting states. Do not claim unsupported sites work automatically.
- `completion_recorded: false` in an `advanced` action is not course completion.
  `finished` is used for bounded traversal only. `course_completed` records the
  site's 100% learning progress, not any separate certificate or exam outcome.

## Maintainers

From the checkout, register this skill with
`node app/scripts/install-skill.mjs --target codex`, `--target hermes`, or
`--target all`. Start a new agent session if its skill catalog needs refreshing.
An unregistered agent cannot reliably map the one-sentence request to this repo.
Build with `cd app && npm ci && npm run build`. Run `npm run check`, `npm run test:unit`, and
`npm test`. Use the repository's controller rather than recreating automation in
an agent prompt. Do not seek forward, change playback speed, fabricate events,
call completion APIs, or change watched records.
