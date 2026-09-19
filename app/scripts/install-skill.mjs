import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const name = 'video-automation-agent';
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function inspect(path, directory) {
  let info;
  try { info = await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile() || info.nlink > 1)) {
    throw new Error(`unsafe_skill_path: ${path}`);
  }
  return info;
}

async function resolveAgentDirectory(path) {
  try { await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return path; throw error; }
  let actual;
  try { actual = await realpath(path); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ELOOP') throw new Error(`unsafe_skill_path: ${path}`);
    throw error;
  }
  await inspect(actual, true);
  return actual;
}

async function skillFiles(source) {
  const files = [];
  async function collect(relative, directory) {
    const path = join(source, relative);
    if (!await inspect(path, directory)) {
      if (relative === 'SKILL.md') throw new Error('missing_skill_source');
      return;
    }
    if (!directory) {
      files.push({ relative, data: await readFile(path) });
      return;
    }
    for (const entry of await readdir(path, { withFileTypes: true })) {
      await collect(join(relative, entry.name), entry.isDirectory());
    }
  }
  await inspect(source, true);
  await collect('SKILL.md', false);
  await collect('agents', true);
  await collect('scripts', true);
  return files;
}

function expandHome(value, home, env) {
  const expanded = value.replace(/\$(?:\{([^}]+)\}|([A-Za-z_][A-Za-z0-9_]*))/g,
    (match, braced, plain) => env[braced || plain] ?? match);
  return resolve(expanded === '~' ? home : /^~[/\\]/.test(expanded) ? join(home, expanded.slice(2)) : expanded);
}

export async function installSkill({ workspace = repository, target = 'all', env = process.env,
  home = homedir(), platform = process.platform } = {}) {
  if (!['codex', 'hermes', 'all'].includes(target)) throw new Error('invalid_target');
  const root = resolve(workspace);
  const files = await skillFiles(join(root, 'skills', name));
  // Hermes uses HERMES_HOME, or LOCALAPPDATA/hermes on Windows and ~/.hermes on POSIX.
  const hermesDefault = platform === 'win32'
    ? join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'hermes') : join(home, '.hermes');
  const homes = {
    codex: expandHome(env.CODEX_HOME?.trim() || join(home, '.codex'), home, env),
    hermes: expandHome(env.HERMES_HOME?.trim() || hermesDefault, home, env),
  };
  const installations = [];
  for (const kind of target === 'all' ? ['codex', 'hermes'] : [target]) {
    // Agent apps may deliberately link their home/skills directory to a shared store.
    const agentHome = await resolveAgentDirectory(homes[kind]);
    const skills = await resolveAgentDirectory(join(agentHome, 'skills'));
    installations.push({ target: kind, path: join(skills, name) });
  }

  // Check every destination before changing either installation.
  for (const destination of installations) {
    if (await inspect(destination.path, true)) {
      const marker = join(destination.path, 'workspace.json');
      await inspect(marker, false);
      let metadata;
      try { metadata = JSON.parse(await readFile(marker, 'utf8')); }
      catch { throw new Error(`unmanaged_skill: ${destination.path}`); }
      if (metadata?.managedBy !== name || metadata?.schemaVersion !== 1) {
        throw new Error(`unmanaged_skill: ${destination.path}`);
      }
    }
    for (const { relative } of files) {
      let parent = dirname(join(destination.path, relative));
      while (parent !== destination.path) {
        await inspect(parent, true);
        parent = dirname(parent);
      }
      await inspect(join(destination.path, relative), false);
    }
  }

  for (const destination of installations) {
    await mkdir(destination.path, { recursive: true });
    for (const { relative, data } of files) {
      const path = join(destination.path, relative);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    }
    await writeFile(join(destination.path, 'workspace.json'), JSON.stringify({
      managedBy: name, schemaVersion: 1, workspace: root,
    }, null, 2) + '\n', { mode: 0o600 });
  }
  return { status: 'installed', installations };
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { target: { type: 'string', default: 'all' } } });
    console.log(JSON.stringify(await installSkill({ target: values.target })));
  } catch (error) {
    const message = String(error.message);
    const status = /^(invalid_target|missing_skill_source|unsafe_skill_path|unmanaged_skill)(:|$)/.exec(message)?.[1]
      || 'installation_failed';
    console.log(JSON.stringify({ status, message }));
    process.exitCode = 1;
  }
}
