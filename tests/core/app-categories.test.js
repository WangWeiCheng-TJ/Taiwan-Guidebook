import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_CATEGORIES } from '../../app/js/views/apps.js';

// scripts/build_dataset.py validates data/apps.json against its own APP_CATEGORIES: keep the two lists equal
// and in the same order (the page shows sections in this order).
const py = readFileSync(new URL('../../scripts/build_dataset.py', import.meta.url), 'utf8');

test('build_dataset.py APP_CATEGORIES equals the UI list, in order', () => {
  const body = py.match(/^APP_CATEGORIES\s*=\s*\[([^\]]*)\]/m);
  assert.ok(body, 'APP_CATEGORIES is defined in build_dataset.py');
  assert.deepEqual([...body[1].matchAll(/["']([\w-]+)["']/g)].map(m => m[1]), [...APP_CATEGORIES]);
});

test('every category has its heading in both languages', async () => {
  const { tr } = await import('../../app/js/lang.js');
  for (const cat of APP_CATEGORIES) {
    for (const lang of ['en', 'zh_TW']) assert.notEqual(tr(lang, `apps.cat.${cat}`), `apps.cat.${cat}`, `${lang} ${cat}`);
  }
});
