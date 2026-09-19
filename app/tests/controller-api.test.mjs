import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function api(href = 'https://tutor-t.thinkforbl.com/courses/42', progress = null) {
  const box = progress && { querySelector: selector => selector.endsWith('-value') ?
    { textContent: progress.label } : { style: { width: progress.width } } };
  const document = { querySelector: selector => selector === '.cv-curriculum-progress' ? box : null,
    querySelectorAll: () => [] };
  const context = vm.createContext({ URL, location: new URL(href), document });
  context.window = context;
  vm.runInContext(readFileSync(new URL('../src/controller.js', import.meta.url), 'utf8'), context);
  return context.VideoAutomationAgent;
}

test('factory supports numeric course URLs without account-specific configuration', () => {
  const controller = api().createController();
  assert.equal(controller.status().running, false);
  assert.equal(controller.status().status, 'not_started');
});

test('factory rejects unrelated or malformed scopes', () => {
  for (const courseUrl of ['https://example.com/courses/42', 'http://tutor-t.thinkforbl.com/courses/42',
    'https://tutor-t.thinkforbl.com/courses/a', 'https://tutor-t.thinkforbl.com/courses/42/extra', 'not-a-url']) {
    assert.throws(() => api().createController({ courseUrl }), /supported|URL/);
  }
});

test('invalid duration is rejected before any playback is started', () => {
  const controller = api().createController();
  for (const hours of [0, -1, NaN, Infinity, 25, '12']) {
    assert.throws(() => controller.start(hours), /hours/);
    assert.equal(controller.status().running, false);
  }
});

test('interaction preference must be a boolean', () => {
  assert.throws(() => api().createController({ skipInteractions: 'false' }), /skipInteractions/);
});

test('goal completion needs the site percentage, not the final video flag', () => {
  const create = progress => api(undefined, progress).createController({ untilComplete: true });
  assert.equal(create({ label: '100%', width: '100%' }).step().status, 'course_completed');
  const rounded = create({ label: '100%', width: '99.9%' }).step();
  assert.equal(rounded.course_progress, 99.9);
  assert.notEqual(rounded.status, 'course_completed');
  assert.notEqual(create({ label: '100%', width: 'invalid' }).step().status, 'course_completed');
});
