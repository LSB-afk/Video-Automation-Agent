# Portable Video Automation Agent implementation plan

**Goal:** Move the working automation into a public, installable, tested project.
**Architecture:** One browser controller shared by userscript and extension builds;
all execution and authentication stay in the user's browser.
**Tech Stack:** Plain JavaScript, Node.js 22+, Playwright, GitHub Actions.
**Spec:** `docs/superpowers/specs/2026-09-19-portable-agent.md`

## Global constraints

No runtime dependencies, credentials, local machine paths, completion spoofing, or
unsupported claims. Preserve live Aside playback during migration. User authorized
building and publishing to the specified repository; proceed through verification.

## Tasks

- [x] **Controller and regression contract.** Migrate the verified v5 behavior to
  `app/src/controller.js`. Write real-media tests first for arbitrary course IDs,
  off-scope rejection, one timer, stop, and normal transitions. Run the failing
  contract, implement the public factory, then run all behavior cases.
- [x] **Distribution and controls.** Build `app/src/panel.js`, `app/scripts/build.mjs`,
  packaging tests, and manifests from the interface in the spec. Test idempotent
  panel mounting, visible status, stop, settings, artifact headers/permissions,
  and ZIP layout. Users should install generated files without a development SDK.
- [x] **Public workspace and documentation.** Add package scripts, lockfile,
  project guidance, MIT license, Korean/English installation and troubleshooting,
  compatibility evidence, reusable assistant skill, contribution instructions,
  issue templates, and CI. Keep current private runtime outside the repository.
- [x] **Completion goal.** Continue across topics and completed text-only entries,
  revisit incomplete entries, and stop only at actual 100%. Preserve truthful
  waiting states and manual Stop. Enable the new goal controller in live Aside.
- [x] **Workspace cleanup.** Group npm JSON and executable code under `app/`,
  put test configuration in `app/config/`, and ignore generated `.artifacts/`.
- [x] **Local validation.** Clean install, syntax/portability checks, 12 Node tests,
  and 145 browser tests passed; 2 Chromium-only extension cases excluded on other
  engines. Review privacy and release contents.
- [ ] **Publication.** Commit with Lore trailers, push main, publish versioned
  release assets, inspect CI, and fix actionable failures before reporting the
  supported/untested matrix.

## Verification commands

```sh
cd app
npm ci
npm run build
npm run check
npm run test:unit
npm test
```

Completion requires the public source and installation packages to exist and
fresh test evidence to support the browser compatibility table.
