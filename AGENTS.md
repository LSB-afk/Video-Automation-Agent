# Project working agreement

This project provides browser-local, real video playback automation. Keep the
controller shared across userscript and extension builds. Browser compatibility
and website compatibility are separate promises.

- Read `docs/superpowers/specs/2026-09-19-portable-agent.md` before architectural changes.
- Do not store credentials, browser profiles, private course content, or runtime logs.
- Do not alter watched time, synthesize completion, submit answers, or call completion APIs.
- Add behavior regression tests for meaningful fixes and keep tests using real media.
- Run commands from `app/`: `npm run build`, `npm run check`, `npm run test:unit`, and relevant Playwright projects.
- Update compatibility claims only when backed by reproducible evidence.
- Generated `app/.artifacts/dist/` comes from `npm run build`; do not edit it directly.
- Use concise intent-first commits with relevant `Tested:`, `Confidence:`, and
  `Scope-risk:` Lore trailers. Keep independent concurrent edits in separate files.
