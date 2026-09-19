---
name: video-automation-agent
description: Use when a user wants Tutor-T videos, supplemental clips, and topic transitions to play continuously in their own browser
---

# Video Automation Agent

Use this repository's release userscript or extension. The automation runs
locally in the user's already-authenticated browser; an LLM API key is unnecessary.

## Start and stop

1. Follow `README.md` for installation and `docs/compatibility.md` for browser limits.
2. Open `https://tutor-t.thinkforbl.com/courses/<numeric-id>` and select a lesson.
3. In the panel, keep **Until 100%** checked to run without a duration deadline,
   or turn it off for a bounded run. Choose whether to skip questions using the
   site's provided Skip buttons. Press Start.
4. Report status only after checking the panel or the active controller. A lesson
   change and increasing playback time prove playback is progressing.
5. Stop ends automation; it does not pause the current video. Refresh requires
   Start again. Keep the browser open and the device awake.

When an authorized browser tool is available, ordinary panel buttons can be
clicked directly. Do not extract credentials or read another browser's profile.
Never run this and an older playback helper simultaneously in the same tab.

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

Build with `cd app && npm ci && npm run build`. Run `npm run check`, `npm run test:unit`, and
`npm test`. Use the repository's controller rather than recreating automation in
an agent prompt. Do not seek forward, change playback speed, fabricate events,
call completion APIs, or change watched records.
