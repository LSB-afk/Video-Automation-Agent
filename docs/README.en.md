# Video Automation Agent

[한국어](../README.md) · [Downloads](https://github.com/LSB-afk/Video-Automation-Agent/releases/latest)

Browser-local playback automation for Tutor-T courses at
`https://tutor-t.thinkforbl.com/courses/<number>`. It plays real videos, handles
supplementary clips and normal navigation controls, and can run until the site's
course completion reaches 100%. No Python, Hermes runtime, or LLM API key is
required for userscript or extension installation.

## Start with one sentence

Register the skill once in Codex or Hermes, then say:

> Install and run the Video Automation Agent in my environment.

The Korean invocation is **내 환경에 영상 자동화 에이전트를 설치하고 실행해줘.**
With Node.js 22+ and Git installed:

```sh
git clone https://github.com/LSB-afk/Video-Automation-Agent.git
cd Video-Automation-Agent
node app/scripts/install-skill.mjs --target all
```

Use `--target codex` or `--target hermes` to register only one. This registers a
skill; it does not install the host agent or configure its model access. Start a
new agent conversation after registration. Codex uses `$CODEX_HOME/skills`
(default `~/.codex/skills`); Hermes uses `$HERMES_HOME/skills` (default
`~/.hermes/skills` on macOS/Linux, `%LOCALAPPDATA%/hermes/skills` on Windows).

The skill can prepare its own checkout when copied independently. It reuses the
user's authenticated course tab, preserves an already-running controller, and
defaults to genuine 100% goal mode. Aside requires its official CLI; other
browsers require an authorized browser connection or userscript/extension
installation. Login, browser permissions, and an ambiguous choice of course may
still need user input. The agent reports these blockers rather than claiming it
started. An agent without this skill cannot infer this repository from that
sentence alone.

Ask **“Show video automation status”** or **“Stop video automation”** to inspect or
stop an existing run without installing or starting a new one. If a checkout is
moved, rerun the registration command there or set `VAA_WORKSPACE`. Registration
stores only the local checkout path in `workspace.json`; it copies no credentials
and does not overwrite an unrelated existing skill.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/get-it/) in a supported browser.
   Safari users can use [Userscripts](https://github.com/quoid/userscripts).
2. Install [video-automation-agent.user.js](https://github.com/LSB-afk/Video-Automation-Agent/releases/latest/download/video-automation-agent.user.js).
   If it downloads instead of opening an installer, import it into your manager or
   paste its entire content into a new script.
3. Log in to Tutor-T, open a course video, and leave the curriculum sidebar open.
4. Use the on-page **Video Automation Agent** panel to select settings and **Start**.

Chromium Tampermonkey users may need **Allow User Scripts** or **Developer Mode**.
See the [official instructions](https://www.tampermonkey.net/faq.php?locale=en&q=Q209).

**Until 100%** is enabled by default. It has no time limit. Disable it to use a
bounded run (up to 24 hours). **Stop** cancels automation without pausing the video.
**Skip questions** uses only skip controls actually offered by the site.

## Completion behavior

The controller reads the curriculum's percentage and precise progress bar. It
does not confuse video progress or a rounded `100%` label with verified course
completion. After the last lesson, goal mode revisits entries the site still
marks incomplete and plays them normally. It stops as `course_completed` only
when the site reaches 100%. If all entries look complete but the percentage is
lower, it waits for the site's update.

No watched time, completion records, or answers are fabricated. Authentication,
network errors, required answers, or unsupported interactions may need your
attention. Keep the browser open and device awake. Reloading requires Start again.

## Other installation options

- **Chromium extension:** extract the Chromium release ZIP, open
  `chrome://extensions` (or your browser's equivalent), enable developer mode, and
  choose **Load unpacked**.
- **Firefox extension:** extract the Firefox ZIP, open `about:debugging`, choose
  **This Firefox → Load Temporary Add-on**, then select `manifest.json`. This
  unsigned package disappears on restart; a userscript is recommended for daily use.
- **Aside:** install its [official CLI](https://docs.aside.com/help/developers) and
  Node.js 22+, clone this repository, then run `node app/scripts/aside.mjs start`,
  `status`, or `stop`. Use `--url` if multiple courses are open. Default is goal mode;
  use `--bounded --hours 4` for a time limit and `--no-skip` to handle questions yourself.

Do not run multiple installation methods or an older helper on the same tab.
There is no store-published or signed extension release. Safari uses a userscript
manager; mobile background playback is not guaranteed.

## Development

```sh
cd app
npm ci
npx playwright install
npm run build
npm run check
npm run test:unit
npm test
npm run package
```

Builds go to `app/.artifacts/dist/`; installation packages go to `app/.artifacts/release/`. The runtime is plain
JavaScript without external dependencies. Tests use original tiny media fixtures
and Chromium, Firefox, and WebKit. CI runs on Linux, macOS, and Windows; WebKit
media tests are excluded on Windows hosted CI for a documented upstream limitation. Engine tests
do not certify every browser brand, manager, or mobile device. See
[compatibility](compatibility.md), [troubleshooting](troubleshooting.md), and
[contributing](../CONTRIBUTING.md). Licensed under [MIT](../LICENSE).
