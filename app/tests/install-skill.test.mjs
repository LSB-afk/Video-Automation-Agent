import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { installSkill } from '../scripts/install-skill.mjs';

const run = promisify(execFile);
const skillName = 'video-automation-agent';
async function fixture(t) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'vaa install with spaces ')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const workspace = join(base, 'source repo');
  const source = join(workspace, 'skills', skillName);
  await mkdir(join(source, 'scripts'), { recursive: true });
  await mkdir(join(source, 'agents'), { recursive: true });
  await writeFile(join(source, 'SKILL.md'), 'Portable skill instructions');
  await writeFile(join(source, 'scripts', 'launch.mjs'), 'console.log("ready");');
  await writeFile(join(source, 'agents', 'openai.yaml'), 'interface: {}\n');
  await writeFile(join(source, 'workspace.json'), '{"workspace":"private-path"}');
  await writeFile(join(source, '.env'), 'PRIVATE_TOKEN=never-copy');
  const env = { CODEX_HOME: join(base, 'custom codex'), HERMES_HOME: join(base, 'custom hermes') };
  return { base, workspace, source, env, home: join(base, 'home') };
}

test('installs standalone skill files into custom homes without copying local state or touching account files', async t => {
  const f = await fixture(t);
  await mkdir(f.env.CODEX_HOME, { recursive: true });
  await writeFile(join(f.env.CODEX_HOME, 'auth.json'), 'existing account');
  const result = await installSkill(f);
  assert.equal(result.status, 'installed');
  assert.deepEqual(result.installations.map(item => item.target), ['codex', 'hermes']);
  for (const { path } of result.installations) {
    assert.deepEqual((await readdir(path)).sort(), ['SKILL.md', 'agents', 'scripts', 'workspace.json']);
    assert.equal(await readFile(join(path, 'scripts', 'launch.mjs'), 'utf8'), 'console.log("ready");');
    assert.equal(await readFile(join(path, 'agents', 'openai.yaml'), 'utf8'), 'interface: {}\n');
    assert.deepEqual(JSON.parse(await readFile(join(path, 'workspace.json'), 'utf8')), {
      managedBy: 'video-automation-agent', schemaVersion: 1, workspace: f.workspace,
    });
  }
  assert.equal(await readFile(join(f.env.CODEX_HOME, 'auth.json'), 'utf8'), 'existing account');
});

test('repeated installation refreshes managed instructions and preserves additional user files', async t => {
  const f = await fixture(t);
  const first = await installSkill({ ...f, target: 'codex' });
  const destination = first.installations[0].path;
  await writeFile(join(destination, 'notes.txt'), 'keep my notes');
  await writeFile(join(f.source, 'SKILL.md'), 'Updated instructions');
  const second = await installSkill({ ...f, target: 'codex' });
  assert.equal(second.installations[0].path, destination);
  assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), 'Updated instructions');
  assert.equal(await readFile(join(destination, 'notes.txt'), 'utf8'), 'keep my notes');
});

test('all-target installation refuses an unmanaged skill before changing either home', async t => {
  const f = await fixture(t);
  const occupied = join(f.env.HERMES_HOME, 'skills', skillName);
  await mkdir(occupied, { recursive: true });
  await writeFile(join(occupied, 'SKILL.md'), 'someone else owns this');
  await assert.rejects(installSkill(f), /unmanaged_skill/);
  assert.equal(await readFile(join(occupied, 'SKILL.md'), 'utf8'), 'someone else owns this');
  await assert.rejects(readdir(f.env.CODEX_HOME), { code: 'ENOENT' });
});

test('a symlink at the skill destination is refused without writing through it', async t => {
  const f = await fixture(t);
  const other = join(f.base, 'other directory');
  await mkdir(other);
  await mkdir(join(f.env.CODEX_HOME, 'skills'), { recursive: true });
  await symlink(other, join(f.env.CODEX_HOME, 'skills', skillName), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installSkill({ ...f, target: 'codex' }), /unsafe_skill_path/);
  assert.deepEqual(await readdir(other), []);
});

test('app-managed home and skills parent symlinks install into their real skill directory', async t => {
  const f = await fixture(t);
  const runtimeHome = join(f.base, 'runtime home');
  const sharedSkills = join(f.base, 'shared skills');
  await mkdir(runtimeHome);
  await mkdir(sharedSkills);
  await writeFile(join(runtimeHome, 'auth.json'), 'existing runtime account');
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  await symlink(runtimeHome, f.env.CODEX_HOME, linkType);
  await symlink(sharedSkills, join(runtimeHome, 'skills'), linkType);
  const result = await installSkill({ ...f, target: 'codex' });
  assert.deepEqual(result.installations, [{ target: 'codex', path: join(sharedSkills, skillName) }]);
  assert.equal(await readFile(join(sharedSkills, skillName, 'SKILL.md'), 'utf8'), 'Portable skill instructions');
  assert.equal(await readFile(join(runtimeHome, 'auth.json'), 'utf8'), 'existing runtime account');
});

test('managed installs refuse a symlinked scripts directory before updating existing files', async t => {
  const f = await fixture(t);
  const first = await installSkill({ ...f, target: 'codex' });
  const destination = first.installations[0].path;
  const other = join(f.base, 'unrelated scripts');
  await mkdir(other);
  await rm(join(destination, 'scripts'), { recursive: true });
  await symlink(other, join(destination, 'scripts'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(f.source, 'SKILL.md'), 'must not update yet');
  await assert.rejects(installSkill({ ...f, target: 'codex' }), /unsafe_skill_path/);
  assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), 'Portable skill instructions');
  assert.deepEqual(await readdir(other), []);
});

test('default paths honor POSIX homes and the native Hermes Windows data directory', async t => {
  const f = await fixture(t);
  const posix = await installSkill({ ...f, env: {}, platform: 'linux' });
  assert.equal(posix.installations[0].path, join(f.home, '.codex', 'skills', skillName));
  assert.equal(posix.installations[1].path, join(f.home, '.hermes', 'skills', skillName));
  const localAppData = join(f.base, 'Local AppData');
  const windows = await installSkill({ ...f, env: { LOCALAPPDATA: localAppData }, platform: 'win32', target: 'hermes' });
  assert.equal(windows.installations[0].path, join(localAppData, 'hermes', 'skills', skillName));
});

test('invalid target exits nonzero with machine-readable output and no installation', async t => {
  const f = await fixture(t);
  const cli = fileURLToPath(new URL('../scripts/install-skill.mjs', import.meta.url));
  const error = await run(process.execPath, [cli, '--target', 'unknown'], { env: { ...process.env, ...f.env } }).catch(value => value);
  assert.equal(error.code, 1);
  assert.equal(JSON.parse(error.stdout).status, 'invalid_target');
  await assert.rejects(readdir(f.env.CODEX_HOME), { code: 'ENOENT' });
});

test('the CLI locates its repository from a different working directory and installs only the selected target', async t => {
  const f = await fixture(t);
  const scripts = join(f.workspace, 'app', 'scripts');
  await mkdir(scripts, { recursive: true });
  const cli = join(scripts, 'install-skill.mjs');
  await copyFile(fileURLToPath(new URL('../scripts/install-skill.mjs', import.meta.url)), cli);
  const { stdout } = await run(process.execPath, [cli, '--target', 'hermes'], {
    cwd: f.base, env: { ...process.env, ...f.env },
  });
  const result = JSON.parse(stdout);
  assert.equal(result.status, 'installed');
  assert.deepEqual(result.installations, [{ target: 'hermes', path: join(f.env.HERMES_HOME, 'skills', skillName) }]);
  const metadata = JSON.parse(await readFile(join(result.installations[0].path, 'workspace.json'), 'utf8'));
  assert.equal(metadata.workspace, await realpath(f.workspace));
  await assert.rejects(readdir(f.env.CODEX_HOME), { code: 'ENOENT' });
});
