// Lists that scripts/build_dataset.py and the app each keep a copy of must agree
// (food kinds: food-kinds.test.js; app categories: apps-view.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PHRASE_GROUPS } from '../../app/js/phrases.js';
import { guidebook } from '../fixtures.js';

const src = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const sorted = list => [...new Set(list)].sort();

/** The quoted items of a top-level `NAME = [...]` list in build_dataset.py. */
function pyList(name) {
  const body = src('scripts/build_dataset.py').match(new RegExp(`^${name}\\s*=\\s*[[{(]([^\\]})]*)`, 'm'))?.[1];
  assert.ok(body, `${name} not found in scripts/build_dataset.py`);
  return sorted([...body.matchAll(/["']([\w-]+)["']/g)].map(m => m[1]));
}

/** The `cat.<name>` heading keys of one language table in lang.js. */
function catKeys() {
  const [en, zh] = src('app/js/lang.js').split('en: {')[1].split('zh_TW: {');
  return [en, zh].map(table => sorted([...table.matchAll(/'cat\.([\w-]+)':/g)].map(m => m[1])));
}

const PHRASES = pyList('PHRASE_CATEGORIES');
const TIPS = pyList('TIP_CATEGORIES');

test('build_dataset.py PHRASE_CATEGORIES is every Phrases-tab group except "top"', () => {
  assert.deepEqual(PHRASES, sorted(PHRASE_GROUPS.map(g => g.id).filter(id => id !== 'top')));
});

test('lang.js has a cat.<name> heading, in both languages, for every phrase group and tip category, and no others', () => {
  const expected = sorted([...PHRASES, ...TIPS, 'top']);
  for (const keys of catKeys()) assert.deepEqual(keys, expected);
});

test('every phrase and tip in the bundle has a known category', () => {
  const phrases = guidebook.phrases.filter(p => !PHRASES.includes(p.category)).map(p => `${p.id}: ${p.category}`);
  const tips = guidebook.tips.filter(t => !TIPS.includes(t.category)).map(t => `${t.id}: ${t.category}`);
  assert.deepEqual([phrases, tips], [[], []]);
});
