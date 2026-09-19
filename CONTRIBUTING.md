# Contributing

Use Node.js 22 or newer. Run the following from the repository root:

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

`app/src/controller.js` contains playback decisions and `app/src/panel.js` contains the
browser UI. Build scripts generate both userscript and extension distributions;
never maintain a second browser-specific copy of playback logic.

Create a failing behavior test before fixing a regression. Tests use original,
tiny synthetic media in `app/tests/fixtures/`, not course recordings or mocked
completion events. Test relevant engines and describe any verification gaps.

Do not commit authentication data, browser profiles, private page snapshots, or
user-specific file paths. Keep runtime permissions scoped to supported sites.
Never fabricate watched time or course completion. New site support needs its own
adapter design, fixtures, permission review, and documentation.

Commits should explain intent and include meaningful Lore trailers, for example:

```text
Keep topic navigation moving when the completion checkmark is delayed

Constraint: Navigation uses the site's normal enabled Next button
Tested: Real-media regression in Chromium, Firefox, and WebKit
Confidence: high
Scope-risk: narrow
```

Open a pull request with the problem, resulting behavior, and commands used to
verify it. Installation/compatibility claims must distinguish engine tests from
manual tests of a particular browser and extension manager.
