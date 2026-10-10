// Contract: reviewFlags takes configurable UI paths (so the gate works outside this project).
// Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewFlags, DEFAULT_UI_PATHS } from '../../.claude/skills/delegate-and-gate/scripts/lib.mjs';

test('DEFAULT_UI_PATHS is exported and keeps the previous behavior', () => {
  assert.deepEqual(DEFAULT_UI_PATHS, ['app/js/views/', 'app/sw.js', 'app/index.html', 'app/app.css']);
  assert.deepEqual(reviewFlags([{ file: 'app/js/views/x.js', added: 1, removed: 0 }], ''), ['Touches UI or offline code: app/js/views/x.js']);
});

test('custom uiPaths: directory prefixes and exact files', () => {
  const numstat = [
    { file: 'src/components/Button.tsx', added: 5, removed: 0 },
    { file: 'src/lib/math.ts', added: 5, removed: 0 },
    { file: 'public/sw.js', added: 1, removed: 0 },
    { file: 'app/js/views/x.js', added: 1, removed: 0 },
  ];
  assert.deepEqual(reviewFlags(numstat, '', { uiPaths: ['src/components/', 'public/sw.js'] }), [
    'Touches UI or offline code: src/components/Button.tsx',
    'Touches UI or offline code: public/sw.js',
  ]);
});

test('empty uiPaths disables the UI flag', () => {
  assert.deepEqual(reviewFlags([{ file: 'app/sw.js', added: 1, removed: 0 }], '', { uiPaths: [] }), []);
});
