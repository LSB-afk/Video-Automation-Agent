#!/usr/bin/env node
// Optional bridge for Aside's official CLI. Authentication stays in Aside.
import { execFile } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chooseTarget, parseResult, discoveryCode } from './aside-lib.mjs';

const execute = promisify(execFile);
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  url: { type: 'string' }, hours: { type: 'string', default: '12' },
  'no-skip': { type: 'boolean', default: false }, bounded: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' }
} });
const command = positionals[0];
if (values.help || !command) {
  console.log('node scripts/aside.mjs start|status|stop [--url https://tutor-t.thinkforbl.com/courses/42] [--bounded --hours 12] [--no-skip]\nDefault: continue until site progress reaches 100%.');
  process.exit(0);
}
if (!['start', 'status', 'stop'].includes(command) || positionals.length > 1) {
  console.error('Choose start, status, or stop.'); process.exit(1);
}
const hours = Number(values.hours);
if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
  console.error('hours must be in (0, 24]'); process.exit(1);
}
const stateDir = join(process.env.XDG_CONFIG_HOME ||
  (process.platform === 'win32' ? process.env.APPDATA || homedir() : join(homedir(), '.config')), 'video-automation-agent');
const binding = join(stateDir, 'aside-binding.json');
let cli = 'aside';
try { await access(join(homedir(), '.local', 'bin', 'aside')); cli = join(homedir(), '.local', 'bin', 'aside'); } catch { /* Use PATH. */ }
async function repl(body) {
  const code = `try { const result = await (async () => { ${body} })(); console.log('VAA_RESULT:' + JSON.stringify(result)); }
    catch (error) { console.log('VAA_RESULT:' + JSON.stringify({_error:error.name})); }`;
  const { stdout, stderr } = await execute(cli, ['repl', code], { timeout: 20000, maxBuffer: 1024 * 1024 });
  return parseResult(stdout + '\n' + stderr);
}
try {
  let pinned = null;
  try { pinned = JSON.parse(await readFile(binding, 'utf8')).targetId; } catch { /* First use. */ }
  const tabs = await repl(discoveryCode(pinned));
  const targetId = chooseTarget(command, tabs, pinned, values.url);
  if (command === 'start' && pinned && pinned !== targetId && tabs.some(t => t.targetId === pinned)) {
    const previous = await repl(`const p=await attachBrowserTab(${JSON.stringify(pinned)}); return await p.evaluate(() => window.__videoAutomationAgent?.status() || {running:false});`);
    if (previous.running) throw new Error('stop_previous_tab_first');
  }
  let action;
  if (command === 'start') {
    const source = await readFile(new URL('../src/controller.js', import.meta.url), 'utf8');
    action = `await p.evaluate(() => { ${source}
      if (window.__tutorPlayback?.status()?.running) return {status:'legacy_helper_running',running:null};
      if (window.__videoAutomationAgent?.status()?.running) return window.__videoAutomationAgent.status();
      window.__videoAutomationAgent?.destroy();
      window.__videoAutomationAgent=window.VideoAutomationAgent.createController({skipInteractions:${!values['no-skip']},untilComplete:${!values.bounded}});
      return window.__videoAutomationAgent.start(${hours}); })`;
  } else {
    action = `await p.evaluate(() => window.__videoAutomationAgent?.${command}() || {status:'not_started',running:false})`;
  }
  const result = await repl(`const p=await attachBrowserTab(${JSON.stringify(targetId)}); return ${action};`);
  if (command === 'start' && result.running === true) {
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
    await writeFile(binding, JSON.stringify({ targetId }) + '\n', { mode: 0o600 });
  }
  console.log(JSON.stringify({ ...result, target_id: targetId }, null, 2));
} catch (error) {
  const known = ['not_started','tab_closed','multiple_course_tabs','waiting_for_course','unsupported_course_url','stop_previous_tab_first'];
  console.error(JSON.stringify({ status: known.includes(error.message) ? error.message : 'connection_failed', running: null,
    hint: error.code === 'ENOENT' ? 'Install the official Aside CLI: https://docs.aside.com/help/developers' : 'Check Aside, the course tab, and the CLI connection.' }));
  process.exitCode = 1;
}
