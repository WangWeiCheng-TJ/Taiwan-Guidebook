// Every file the app needs must be precached, or it breaks offline without any visible error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('../../app/', import.meta.url));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
}

test('sw.js SHELL lists every app module, stylesheet, icon and the data bundle', () => {
  const sw = readFileSync(join(appDir, 'sw.js'), 'utf8');
  const shell = new Set([...sw.matchAll(/'([^']+)'/g)].map(m => m[1]));
  const needed = walk(appDir)
    .map(f => relative(appDir, f).split('\\').join('/'))
    .filter(f => /^(js\/.*\.js|icons\/.*\.png|app\.css|index\.html|manifest\.webmanifest|data\/guidebook\.json)$/.test(f));
  const missing = needed.filter(f => !shell.has(f));
  assert.deepEqual(missing, [], `Add to SHELL in app/sw.js and bump CACHE: ${missing.join(', ')}`);
});
