# One-sentence invocation

## Outcome and boundaries

After one-time skill registration, Codex or Hermes recognizes the Korean request
“내 환경에 영상 자동화 에이전트를 설치하고 실행해줘” and prepares the public
workspace, connects to the available user browser, starts real playback toward
100%, and verifies actual state. A standalone installed skill must not rely on
unavailable repo-relative README files. Host agent installation, authentication,
and unavailable browser permissions are explicit prerequisites, not implied
success. The existing playback controller and browser artifacts remain shared.

## Implementation sequence

1. Add meaningful filesystem regressions for standalone bootstrap, bad bindings,
   non-destructive repeat installation, and status/stop without side effects.
2. Add a dependency-free launcher bundled in the skill and a repository installer
   for Codex/Hermes homes, with a local-only workspace binding.
3. Update skill triggers, browser routing, UI metadata, and usage documentation.
4. Validate independent skill use, Node checks, packaging, and live Aside state.
   Register both local skills, then commit and push the reviewed changes.

## Acceptance evidence

- A skill copied alone finds a configured checkout from an unrelated directory.
- Fresh prepare downloads the documented public source; no destructive update.
- Invalid bindings/paths and unmanaged installation destinations preserve files.
- Status/stop on a fresh installation never clones or starts automation.
- Repeat start leaves the active course controller running without duplication.
- Read status twice on the real course; report observed playback and progress.
- Portable syntax checks and unit tests include the installed bootstrap script.
