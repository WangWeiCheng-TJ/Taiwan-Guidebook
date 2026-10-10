// Contract for scripts/agy/lib.mjs. Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgyJson, summarizeTests, checkScope, reviewFlags, decide, retryPrompt } from '../../.claude/skills/delegate-and-gate/scripts/lib.mjs';

test('parseAgyJson takes the last JSON line with a status', () => {
  const out = [
    'ERROR: logging before google.Init: I1010 something',
    'jetski: no output produced — a tool required the "command" permission',
    '{"not":"this"}',
    JSON.stringify({ conversation_id: 'abc', status: 'SUCCESS', response: 'done', usage: { output_tokens: 10, total_tokens: 99 },
      denied_actions: [{ action: 'command', display_name: 'RunCommand' }, { action: 'write_file' }] }),
  ].join('\n');
  assert.deepEqual(parseAgyJson(out), {
    conversationId: 'abc', status: 'SUCCESS', response: 'done', denied: ['command', 'write_file'],
    usage: { output: 10, total: 99 }, error: null,
  });
});

test('parseAgyJson defaults and errors', () => {
  const r = parseAgyJson('{"conversation_id":"x","status":"ERROR","error":"boom"}');
  assert.equal(r.status, 'ERROR');
  assert.equal(r.error, 'boom');
  assert.deepEqual(r.denied, []);
  assert.equal(r.usage, null);
  assert.equal(r.response, '');
  assert.deepEqual(parseAgyJson('nothing useful\n'), {
    conversationId: null, status: 'NO_JSON', response: '', denied: [], usage: null, error: 'No JSON result from agy.',
  });
});

test('summarizeTests: node --test', () => {
  const out = [
    '✔ ok one (1.2ms)',
    '✖ parseTrip rejects bad input (3.1ms)',
    'ℹ tests 3', 'ℹ pass 2', 'ℹ fail 1',
    '✖ failing tests:',
    '✖ parseTrip rejects bad input (3.1ms)',
  ].join('\n');
  assert.deepEqual(summarizeTests(out), { pass: 2, fail: 1, failing: ['parseTrip rejects bad input'] });
  assert.deepEqual(summarizeTests('ℹ tests 5\nℹ pass 5\nℹ fail 0'), { pass: 5, fail: 0, failing: [] });
});

test('summarizeTests: python unittest', () => {
  const failed = [
    'ERROR: test_real_file (test_migrate_i18n.MigrateAttraction.test_real_file)',
    'FAIL: test_scalars (test_migrate_i18n.MergeLangPairs.test_scalars)',
    'Ran 8 tests in 0.003s', '', 'FAILED (failures=1, errors=1)',
  ].join('\n');
  assert.deepEqual(summarizeTests(failed), { pass: 6, fail: 2, failing: ['test_real_file', 'test_scalars'] });
  assert.deepEqual(summarizeTests('Ran 8 tests in 0.001s\n\nOK'), { pass: 8, fail: 0, failing: [] });
  assert.deepEqual(summarizeTests('Ran 3 tests in 0.1s\n\nFAILED (errors=3)').fail, 3);
});

test('summarizeTests: unreadable output counts as a failure', () => {
  assert.deepEqual(summarizeTests('Segmentation fault'), { pass: 0, fail: 1, failing: ['(could not read test output)'] });
});

test('checkScope', () => {
  const r = checkScope(['app/js/i18n.js', 'scripts\\migrate_i18n.py', 'app/js/main.js', 'tests/py/test_x.py'],
    ['app/js/i18n.js', 'scripts/', 'tests/py/']);
  assert.deepEqual(r, { outside: ['app/js/main.js'], testsTouched: ['tests/py/test_x.py'] });
  assert.deepEqual(checkScope([], ['a.js']), { outside: [], testsTouched: [] });
});

test('reviewFlags', () => {
  const numstat = [{ file: 'app/js/views/trip.js', added: 120, removed: 2 }, { file: 'app/js/trip.js', added: 40, removed: 0 }];
  const diff = [
    '+++ b/app/js/views/trip.js',
    '+  el.innerHTML = html;',
    '+  // TODO tidy',
    '-  old innerHTML line is ignored',
    '+  const f = new Function("x", "return x");',
  ].join('\n');
  assert.deepEqual(reviewFlags(numstat, diff), [
    'Large change: 160 lines added.',
    'Touches UI or offline code: app/js/views/trip.js',
    'Uses innerHTML: check escaping.',
    'Uses eval or new Function.',
    'Leaves a TODO or FIXME.',
  ]);
  assert.deepEqual(reviewFlags([{ file: 'app/js/i18n.js', added: 30, removed: 3 }], '+ return x;'), []);
  assert.deepEqual(reviewFlags([{ file: 'x.js', added: 30, removed: 0 }], '', { maxAdded: 20 }), ['Large change: 30 lines added.']);
  assert.deepEqual(reviewFlags([{ file: 'app/sw.js', added: 1, removed: 1 }], ''), ['Touches UI or offline code: app/sw.js']);
});

test('decide', () => {
  assert.equal(decide(['Tests failed'], []), 'reject');
  assert.equal(decide(['x'], ['y']), 'reject');
  assert.equal(decide([], ['Large change: 300 lines added.']), 'review');
  assert.equal(decide([], []), 'accept');
});

test('retryPrompt keeps the last lines of each failure', () => {
  const long = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
  const p = retryPrompt([{ command: 'npm test', output: long }, { command: 'node --test x', output: 'boom' }], 3);
  assert.equal(p, [
    'These checks failed. Fix the implementation, not the tests, then run them again.',
    '', '$ npm test', 'line 48', 'line 49', 'line 50',
    '', '$ node --test x', 'boom',
  ].join('\n'));
});
