#!/usr/bin/env node
// Self-contained: this file also runs when only the skill directory is installed.
import { execFile, spawn } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { access, mkdir, readFile, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'https://github.com/LSB-afk/Video-Automation-Agent.git';
const skillDirectory = fileURLToPath(new URL('../', import.meta.url));
const execute = promisify(execFile);

async function isWorkspace(directory) {
  try {
    const pkg = JSON.parse(await readFile(join(directory, 'app/package.json'), 'utf8'));
    if (pkg.name !== 'video-automation-agent') return false;
    await Promise.all(['app/scripts/aside.mjs', 'app/src/controller.js', 'app/src/panel.js']
      .map(file => access(join(directory, file))));
    return true;
  } catch { return false; }
}

async function workspaceFor(command, explicit) {
  let selected = explicit || process.env.VAA_WORKSPACE;
  if (!selected) {
    try {
      const binding = JSON.parse(await readFile(join(skillDirectory, 'workspace.json'), 'utf8'));
      if (binding.managedBy !== 'video-automation-agent' || binding.schemaVersion !== 1 ||
          typeof binding.workspace !== 'string' || !binding.workspace) throw new Error('invalid_binding');
      selected = binding.workspace;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('invalid_binding');
    }
  }
  if (selected) {
    const directory = resolve(selected);
    if (!await isWorkspace(directory)) throw new Error('invalid_workspace');
    return directory;
  }
  const bundled = resolve(skillDirectory, '../..');
  if (await isWorkspace(bundled)) return bundled;

  const directory = join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'),
    'video-automation-agent', 'workspace');
  if (await isWorkspace(directory)) return directory;
  if (command === 'status' || command === 'stop') throw new Error('not_installed');
  try {
    await lstat(directory);
    throw new Error('workspace_path_in_use');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(directory), { recursive: true });
  try {
    await execute('git', ['clone', '--depth', '1', '--', repository, directory], {
      timeout: 120000, maxBuffer: 1024 * 1024
    });
  } catch (error) {
    throw new Error(error.code === 'ENOENT' ? 'git_missing' : 'clone_failed');
  }
  if (!await isWorkspace(directory)) throw new Error('invalid_workspace');
  return directory;
}

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    workspace: { type: 'string' }, url: { type: 'string' }, hours: { type: 'string' },
    bounded: { type: 'boolean' }, 'no-skip': { type: 'boolean' }, help: { type: 'boolean', short: 'h' }
  } });
  const command = positionals[0] || 'start';
  if (values.help) {
    console.log('bootstrap.mjs prepare|start|status|stop [--workspace PATH] [--url COURSE] [--bounded --hours 4] [--no-skip]\nprepare locates/installs source; start/status/stop use the official Aside CLI. Other browsers use their authorized browser tool or the on-page panel.');
  } else {
    if (!['prepare', 'start', 'status', 'stop'].includes(command) || positionals.length > 1) throw new Error('invalid_command');
    const workspace = await workspaceFor(command, values.workspace);
    if (command === 'prepare') {
      console.log(JSON.stringify({ status: 'ready', running: null, workspace,
        controller: join(workspace, 'app/src/controller.js'), panel: join(workspace, 'app/src/panel.js'),
        readme: join(workspace, 'README.md') }, null, 2));
    } else {
      const args = [join(workspace, 'app/scripts/aside.mjs'), command];
      for (const key of ['url', 'hours']) if (values[key]) args.push(`--${key}`, values[key]);
      for (const key of ['bounded', 'no-skip']) if (values[key]) args.push(`--${key}`);
      const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true });
      process.exitCode = await new Promise((resolveExit, reject) => {
        child.on('error', reject);
        child.on('exit', code => resolveExit(code ?? 1));
      });
    }
  }
} catch (error) {
  const hints = {
    invalid_binding: 'Repair the installed skill workspace.json or pass --workspace with an existing checkout.',
    invalid_workspace: 'The selected checkout is missing or invalid. Pass --workspace with the correct repository path.',
    not_installed: 'No local workspace was found. Nothing was installed or started; inspect an existing browser panel if present.',
    workspace_path_in_use: 'The default workspace path contains unrelated files. Leave them intact and select another checkout.',
    git_missing: 'Install Git to download the repository, or select an existing checkout with --workspace.',
    clone_failed: 'Check network access to GitHub and Git, then retry.',
    invalid_command: 'Choose prepare, start, status, or stop.'
  };
  const status = Object.hasOwn(hints, error.message) ? error.message : 'setup_failed';
  console.error(JSON.stringify({ status, running: null, hint: hints[status] || 'Check Node.js 22+, arguments, and filesystem permissions.' }));
  process.exitCode = 1;
}
