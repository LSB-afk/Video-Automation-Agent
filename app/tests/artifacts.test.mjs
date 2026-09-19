import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { before, test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url));
const run = (script) => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};

before(() => run('scripts/package.mjs'));

test('both extension builds expose only the supported course content script', async () => {
  for (const browser of ['chromium', 'firefox']) {
    const manifest = JSON.parse(await read(`.artifacts/dist/${browser}/manifest.json`));
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.content_scripts, [{
      matches: ['https://tutor-t.thinkforbl.com/courses/*'],
      js: ['content.js'], run_at: 'document_idle', all_frames: false,
    }]);
    for (const broadAccess of ['permissions', 'host_permissions', 'optional_permissions',
      'optional_host_permissions', 'background', 'web_accessible_resources', 'externally_connectable']) {
      assert.equal(manifest[broadAccess], undefined, `${browser}: unexpected ${broadAccess}`);
    }
    const content = (await read(`.artifacts/dist/${browser}/content.js`)).toString();
    assert.doesNotThrow(() => new Script(content));
    assert.equal(content, (await read('src/controller.js')).toString().trimEnd()
      + '\n\n' + (await read('src/panel.js')).toString().trimEnd() + '\n');
    assert.deepEqual(await read(`.artifacts/dist/${browser}/LICENSE`), await read('../LICENSE'));
  }
  const firefox = JSON.parse(await read('.artifacts/dist/firefox/manifest.json'));
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] });
  assert.ok(firefox.browser_specific_settings.gecko.id);
});

test('the userscript is self-contained and installs only on supported course pages', async () => {
  const userscript = (await read('.artifacts/dist/video-automation-agent.user.js')).toString();
  assert.match(userscript, /^\/\/ ==UserScript==\n/);
  assert.match(userscript, /\/\/ @match\s+https:\/\/tutor-t\.thinkforbl\.com\/courses\/\*\n/);
  assert.match(userscript, /\/\/ @grant\s+none\n/);
  assert.match(userscript, /\/\/ @run-at\s+document-idle\n/);
  assert.match(userscript, /\/\/ @downloadURL\s+https:\/\/github\.com\/LSB-afk\/Video-Automation-Agent\/releases\/latest\/download\/video-automation-agent\.user\.js\n/);
  assert.doesNotMatch(userscript, /\/\/ @(?:require|connect)\s/);
  assert.doesNotThrow(() => new Script(userscript));
  assert.ok(userscript.includes(`/*\n${(await read('../LICENSE')).toString().trimEnd()}\n*/`), 'userscript includes the full MIT license');
  assert.deepEqual(await read('.artifacts/release/video-automation-agent.user.js'), Buffer.from(userscript));
});

// Parse standard ZIP local records independently of the packaging implementation.
function unpack(zip) {
  const entries = new Map();
  let position = 0;
  while (zip.readUInt32LE(position) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(position + 8), 0, 'release uses stored ZIP entries');
    const size = zip.readUInt32LE(position + 18);
    const nameLength = zip.readUInt16LE(position + 26);
    const extraLength = zip.readUInt16LE(position + 28);
    const name = zip.toString('utf8', position + 30, position + 30 + nameLength);
    const start = position + 30 + nameLength + extraLength;
    entries.set(name, zip.subarray(start, start + size));
    position = start + size;
  }
  assert.equal(zip.readUInt32LE(position), 0x02014b50, 'central directory follows file data');
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50, 'ZIP end record exists');
  assert.equal(zip.readUInt16LE(zip.length - 12), entries.size, 'directory entry count matches');
  return entries;
}

test('release ZIPs install from their root and repeat builds are byte-identical', async () => {
  const names = ['video-automation-agent-chromium.zip', 'video-automation-agent-firefox.zip',
    'video-automation-agent.user.js'];
  assert.deepEqual((await readdir(new URL('../.artifacts/release/', import.meta.url))).sort(), names.sort());
  const beforeBuild = new Map(await Promise.all(names.map(async (name) => [name, await read(`.artifacts/release/${name}`)])));
  for (const browser of ['chromium', 'firefox']) {
    const files = unpack(beforeBuild.get(`video-automation-agent-${browser}.zip`));
    assert.deepEqual([...files.keys()].sort(), ['LICENSE', 'content.js', 'manifest.json']);
    for (const [name, content] of files) assert.deepEqual(content, await read(`.artifacts/dist/${browser}/${name}`));
  }
  run('scripts/package.mjs');
  for (const name of names) assert.deepEqual(await read(`.artifacts/release/${name}`), beforeBuild.get(name));
});
