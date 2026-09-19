import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async (path) => (await readFile(new URL(path, root), 'utf8')).trimEnd();
const { version } = JSON.parse(await read('package.json'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Release version must have three numeric components');
const repository = 'https://github.com/LSB-afk/Video-Automation-Agent';
const license = (await readFile(new URL('../../LICENSE', import.meta.url), 'utf8')).trimEnd();
const content = `${await read('src/controller.js')}\n\n${await read('src/panel.js')}\n`;
const metadata = `// ==UserScript==
// @name         Video Automation Agent
// @namespace    ${repository}
// @version      ${version}
// @description  Browser-local Tutor-T playback, supplementary videos, and next-topic navigation.
// @homepageURL  ${repository}
// @supportURL   ${repository}/issues
// @downloadURL  ${repository}/releases/latest/download/video-automation-agent.user.js
// @updateURL    ${repository}/releases/latest/download/video-automation-agent.user.js
// @match        https://tutor-t.thinkforbl.com/courses/*
// @grant        none
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==

`;
const manifest = {
  manifest_version: 3,
  name: 'Video Automation Agent',
  version,
  description: 'Browser-local Tutor-T playback with Start, Stop, and normal next-topic navigation.',
  homepage_url: repository,
  content_scripts: [{
    matches: ['https://tutor-t.thinkforbl.com/courses/*'],
    js: ['content.js'],
    run_at: 'document_idle',
    all_frames: false,
  }],
};
await rm(new URL('.artifacts/dist/', root), { recursive: true, force: true });
for (const browser of ['chromium', 'firefox']) {
  await mkdir(new URL(`.artifacts/dist/${browser}/`, root), { recursive: true });
  const browserManifest = browser === 'firefox' ? {
    ...manifest,
    browser_specific_settings: {
      gecko: {
        id: 'video-automation-agent@lsb-afk.github.io',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] },
      },
    },
  } : manifest;
  await writeFile(new URL(`.artifacts/dist/${browser}/manifest.json`, root), `${JSON.stringify(browserManifest, null, 2)}\n`);
  await writeFile(new URL(`.artifacts/dist/${browser}/content.js`, root), content);
  await writeFile(new URL(`.artifacts/dist/${browser}/LICENSE`, root), `${license}\n`);
}
await writeFile(new URL('.artifacts/dist/video-automation-agent.user.js', root), `${metadata}/*\n${license}\n*/\n\n${content}`);
console.log(`Built Video Automation Agent ${version}: userscript, Chromium, and Firefox.`);
