import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = join(root, 'skills/video-automation-agent/scripts/bootstrap.mjs');

async function isolated(t) {
  const home = await mkdtemp(join(tmpdir(), 'vaa bootstrap '));
  t.after(() => rm(home, { recursive: true, force: true }));
  const skill = join(home, 'installed skill');
  await mkdir(join(skill, 'scripts'), { recursive: true });
  const script = join(skill, 'scripts/bootstrap.mjs');
  await copyFile(source, script);
  const env = { ...process.env, HOME: home, USERPROFILE: home, VAA_WORKSPACE: '', XDG_DATA_HOME: join(home, 'data') };
  return { home, skill, run: args => execute(process.execPath, [script, ...args], { cwd: home, env }) };
}

test('an independently installed skill prepares its bound workspace from an unrelated cwd', async t => {
  const { skill, run } = await isolated(t);
  await writeFile(join(skill, 'workspace.json'), JSON.stringify({ managedBy: 'video-automation-agent', schemaVersion: 1, workspace: root }));
  const { stdout } = await run(['prepare']);
  const result = JSON.parse(stdout);
  assert.equal(result.status, 'ready');
  assert.equal(resolve(result.workspace), resolve(root));
  assert.equal(result.running, null);
  await readFile(result.controller);
  await readFile(result.panel);
});

test('a stale explicit workspace fails without replacing unrelated files or cloning elsewhere', async t => {
  const { home, run } = await isolated(t);
  const wrong = join(home, 'my documents');
  await mkdir(wrong);
  await writeFile(join(wrong, 'keep.txt'), 'user data');
  await assert.rejects(run(['prepare', '--workspace', wrong]), error => {
    assert.equal(JSON.parse(error.stderr).status, 'invalid_workspace');
    return true;
  });
  assert.equal(await readFile(join(wrong, 'keep.txt'), 'utf8'), 'user data');
  assert.deepEqual(await readdir(wrong), ['keep.txt']);
});

test('status and stop on a fresh machine never install or start an agent', async t => {
  const { home, run } = await isolated(t);
  const before = await readdir(home);
  for (const command of ['status', 'stop']) {
    await assert.rejects(run([command]), error => {
      assert.equal(JSON.parse(error.stderr).status, 'not_installed');
      return true;
    });
  }
  assert.deepEqual(await readdir(home), before);
});

test('malformed binding is reported instead of silently installing another workspace', async t => {
  const { skill, run } = await isolated(t);
  await writeFile(join(skill, 'workspace.json'), '{broken');
  await assert.rejects(run(['prepare']), error => {
    assert.equal(JSON.parse(error.stderr).status, 'invalid_binding');
    return true;
  });
  const { stdout } = await run(['prepare', '--workspace', root]);
  assert.equal(JSON.parse(stdout).status, 'ready');
});
