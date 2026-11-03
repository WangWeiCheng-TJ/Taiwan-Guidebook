// The log form follows today's date while the app stays open past midnight (audit logic #4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { draftDate, emptyDraft, makeEntry } from '../../app/js/triplog.js';
import { today } from '../../app/js/util.js';
import { state } from '../../app/js/state.js';
import { renderLog } from '../../app/js/views/log.js';
import { guidebook } from '../fixtures.js';

test('draftDate: today is kept as "" (follow today); other dates and a cleared field as given', () => {
  assert.equal(draftDate('2026-11-03', '2026-11-03'), '');
  assert.equal(draftDate('2026-11-01', '2026-11-03'), '2026-11-01');
  assert.equal(draftDate('2026-11-05', '2026-11-03'), '2026-11-05');
  assert.equal(draftDate('', '2026-11-03'), '');
});

test('a draft that follows today is saved under the day of saving, not the day the app started', () => {
  // The form was set up on 11-03 and the user touched the date field that day: still "".
  let draft = emptyDraft('');
  draft = { ...draft, date: draftDate('2026-11-03', '2026-11-03'), placeId: 'chihkan-tower', stars: 4 };
  // Saved after midnight: main.js passes today() as the fallback.
  assert.equal(makeEntry(draft, 'x', '2026-11-04').date, '2026-11-04');
  // The next empty draft carries "" forward, so the following save also lands on the right day.
  assert.equal(makeEntry({ ...emptyDraft(draft.date), name: 'Tea', note: 'ok' }, 'y', '2026-11-05').date, '2026-11-05');
  // A date the user picked on purpose stays.
  assert.equal(makeEntry({ ...draft, date: draftDate('2026-11-01', '2026-11-03') }, 'z', '2026-11-04').date, '2026-11-01');
});

test('state starts with a draft that follows today, and the form shows today for it', () => {
  assert.equal(state.draft.date, '');
  const prev = state.data;
  state.data = guidebook;
  try {
    const html = renderLog({ ...state, draft: emptyDraft('') });
    assert.match(html, new RegExp(`<input type="date" name="date" value="${today()}">`));
    const picked = renderLog({ ...state, draft: emptyDraft('2026-11-01') });
    assert.match(picked, /<input type="date" name="date" value="2026-11-01">/);
  } finally {
    state.data = prev;
  }
});
