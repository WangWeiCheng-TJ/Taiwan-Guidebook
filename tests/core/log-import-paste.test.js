// My trip: Import is a button a keyboard reaches (audit ui #15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../app/js/state.js';
import { tr } from '../../app/js/lang.js';
import { renderLog } from '../../app/js/views/log.js';
import { guidebook } from '../fixtures.js';

state.data = guidebook;
const s = (over = {}) => ({ ...state, data: guidebook, ...over });

test('Import is a button (focusable); the file input it opens stays hidden', () => {
  const out = renderLog(s({ lang: 'en' }));
  assert.ok(out.includes(`<button class="btn" type="button" data-action="import">${tr('en', 'import')}</button>`));
  assert.match(out, /<input type="file" accept="application\/json,\.json" data-change="import" hidden>/);
  assert.doesNotMatch(out, /<label[^>]*>[^<]*<input type="file"/, 'no longer a label wrapping a hidden input');
});

