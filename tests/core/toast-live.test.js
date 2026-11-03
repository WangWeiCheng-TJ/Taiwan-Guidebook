// The page is not one big live region; the toast is (audit ui #8 / css #12). Before, every render of #view
// queued the whole page for screen readers, and toasts, toggled with `hidden`, were never announced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');

/** The opening tag of the element with this id in index.html. */
const tagOf = id => html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))[0];

test('index.html: #view is not a live region; the toast is, and is never hidden', () => {
  assert.doesNotMatch(tagOf('view'), /aria-live/, 'every render would read the whole page');
  const toast = tagOf('toast');
  assert.match(toast, /role="status"/);
  assert.match(toast, /aria-live="polite"/);
  assert.doesNotMatch(toast, /\bhidden\b/, 'a live region must stay in the accessibility tree');
});

test('app.css: an empty toast takes no space (it is no longer hidden)', () => {
  const css = readFileSync(new URL('../../app/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.toast:empty\s*\{\s*padding:\s*0;?\s*\}/);
});
