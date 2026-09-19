import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseTarget, parseResult, discoveryCode } from '../scripts/aside-lib.mjs';

const tab = (targetId, url = 'https://tutor-t.thinkforbl.com/courses/42') => ({ targetId, url });
test('discovery code executes as JavaScript and returns only scope or pinned tabs', async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const discover = new AsyncFunction('listBrowserTabs', discoveryCode('pinned'));
  const result = await discover(async () => [tab('a'), tab('b', 'https://example.com'), tab('pinned', 'https://example.com')]);
  assert.deepEqual(result.map(t => t.targetId), ['a', 'pinned']);
});
test('start requires one supported course, or an explicit course URL', () => {
  assert.equal(chooseTarget('start', [tab('a')]), 'a');
  assert.throws(() => chooseTarget('start', [tab('a'), tab('b')]), /multiple_course_tabs/);
  assert.throws(() => chooseTarget('start', [tab('a', 'https://example.com')]), /waiting_for_course/);
  assert.equal(chooseTarget('start', [tab('a'), tab('b', 'https://tutor-t.thinkforbl.com/courses/9')], null,
    'https://tutor-t.thinkforbl.com/courses/9'), 'b');
});
test('status and stop follow the pinned tab even after navigation', () => {
  assert.equal(chooseTarget('stop', [tab('a', 'https://example.com'), tab('b')], 'a'), 'a');
  assert.throws(() => chooseTarget('stop', [tab('b')], 'a'), /tab_closed/);
  assert.throws(() => chooseTarget('stop', [tab('b')], null), /not_started/);
});
test('CLI success exit with an embedded error is treated as failure', () => {
  assert.deepEqual(parseResult('VAA_RESULT:{"running":true}\n[ok]'), { running: true });
  assert.throws(() => parseResult('VAA_RESULT:{"_error":"TypeError"}'), /connection_failed/);
  assert.throws(() => parseResult('some CLI warning'), /aside_command_failed/);
});
