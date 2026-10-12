// A food kind lives in 4 places (CLAUDE.md, "Rules that bite"); they must list the same kinds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOOD_KINDS } from '../../app/js/views/food.js';
import { guidebook } from '../fixtures.js';

const src = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const sorted = list => [...new Set(list)].sort();
const KINDS = sorted(FOOD_KINDS);

test('build_dataset.py FOOD_KINDS matches the UI list', () => {
  const body = src('scripts/build_dataset.py').match(/^FOOD_KINDS\s*=\s*[[{(]([^\]})]*)/m)?.[1];
  assert.ok(body, 'FOOD_KINDS not found in scripts/build_dataset.py');
  assert.deepEqual(sorted([...body.matchAll(/["'](\w+)["']/g)].map(m => m[1])), KINDS);
});

test('prompt.js FOOD_KIND_EN has a label for each kind, and no others', () => {
  const body = src('app/js/prompt.js').match(/const FOOD_KIND_EN = \{([^}]*)\}/)?.[1];
  assert.ok(body, 'FOOD_KIND_EN not found in app/js/prompt.js');
  assert.deepEqual(sorted([...body.matchAll(/(\w+):/g)].map(m => m[1])), KINDS);
});

test('lang.js has food.<kind> in both en and zh_TW, and no others', () => {
  const [en, zh] = src('app/js/lang.js').split('en: {')[1].split('zh_TW: {');
  for (const table of [en, zh]) {
    const keys = [...table.matchAll(/'food\.(\w+)':/g)].map(m => m[1]).filter(k => k !== 'local');
    assert.deepEqual(sorted(keys), KINDS);
  }
});

test('every food pick in the bundle has a known kind', () => {
  const bad = guidebook.food.flatMap(c => c.picks.filter(p => !FOOD_KINDS.includes(p.kind)).map(p => `${p.id}: ${p.kind}`));
  assert.deepEqual(bad, []);
});
