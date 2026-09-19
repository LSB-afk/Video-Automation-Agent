# Project working agreement

This project provides browser-local, real video playback automation. Keep the
controller shared across userscript and extension builds. Browser compatibility
and website compatibility are separate promises.

For requests such as “내 환경에 영상 자동화 에이전트를 설치하고 실행해줘” or
“영상 자동화 시작해줘”, use `skills/video-automation-agent/SKILL.md`.
Register with `node app/scripts/install-skill.mjs --target all` when the user
wants future one-sentence invocation outside this checkout. Status/stop requests
inspect existing automation; they do not install or start a new controller.

- Read `docs/superpowers/specs/2026-09-19-portable-agent.md` before architectural changes.
- Do not store credentials, browser profiles, private course content, or runtime logs.
- Do not alter watched time, synthesize completion, submit answers, or call completion APIs.
- Add behavior regression tests for meaningful fixes and keep tests using real media.
- Run commands from `app/`: `npm run build`, `npm run check`, `npm run test:unit`, and relevant Playwright projects.
- Update compatibility claims only when backed by reproducible evidence.
- Generated `app/.artifacts/dist/` comes from `npm run build`; do not edit it directly.
- Use concise intent-first commits with relevant `Tested:`, `Confidence:`, and
  `Scope-risk:` Lore trailers. Keep independent concurrent edits in separate files.
