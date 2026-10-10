import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDraft, validateDraft, makeEntry, removeEntry, exportPayload, mergeImport,
  firstDate, dayNumber, entryName, groupByDate, notesFor, EXPORT_TYPE,
} from '../../app/js/triplog.js';
import { places, sampleLog } from '../fixtures.js';

test('validateDraft requires a place or name, and a rating or note', () => {
  const d = emptyDraft('2026-11-03');
  assert.equal(validateDraft(d), 'Pick a place or type a name.');
  assert.equal(validateDraft({ ...d, name: '  ' }), 'Pick a place or type a name.');
  assert.equal(validateDraft({ ...d, name: 'Curry' }), 'Add a rating or a note.');
  assert.equal(validateDraft({ ...d, name: 'Curry', note: 'too salty' }), null);
  assert.equal(validateDraft({ ...d, placeId: 'chihkan-tower', stars: 4 }), null);
});

test('makeEntry trims, drops name for guidebook places, nulls empty stars', () => {
  const e = makeEntry({ date: '', placeId: 'chihkan-tower', name: 'ignored', stars: 0, note: ' nice ' }, 'x1', '2026-11-04');
  assert.deepEqual(e, { id: 'x1', date: '2026-11-04', placeId: 'chihkan-tower', name: '', stars: null, note: 'nice' });
  const f = makeEntry({ date: '2026-11-05', placeId: '', name: ' Curry ', stars: 2, note: '' }, 'x2', 'unused');
  assert.deepEqual(f, { id: 'x2', date: '2026-11-05', placeId: null, name: 'Curry', stars: 2, note: '' });
});

test('removeEntry returns a new array', () => {
  const out = removeEntry(sampleLog, 'c');
  assert.equal(out.length, 2);
  assert.equal(sampleLog.length, 3);
});

test('export then import round-trips and skips duplicates', () => {
  const payload = exportPayload(sampleLog, new Date('2026-11-04T00:00:00Z'));
  assert.equal(payload.type, EXPORT_TYPE);
  const parsed = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(mergeImport([], parsed), { log: sampleLog, added: 3 });
  assert.equal(mergeImport(sampleLog, parsed).added, 0);
  assert.equal(mergeImport([], [sampleLog[0], { id: 'no-date' }]).added, 1); // bare array, invalid skipped
  assert.throws(() => mergeImport([], { hello: 1 }));
});

test('trip days count from the first logged date', () => {
  assert.equal(firstDate(sampleLog), '2026-11-02');
  assert.equal(dayNumber(sampleLog, '2026-11-04'), 3);
  assert.equal(dayNumber([], '2026-11-04'), null);
});

test('entryName prefers the guidebook name', () => {
  assert.equal(entryName(sampleLog[0], places), 'Lukang Longshan Temple');
  assert.equal(entryName(sampleLog[1], places), 'Curry shop');
});

test('groupByDate is newest first and keeps order within a day', () => {
  const g = groupByDate(sampleLog);
  assert.deepEqual(g.map(([d]) => d), ['2026-11-03', '2026-11-02']);
  assert.deepEqual(g[0][1].map(e => e.id), ['b', 'c']);
});

test('notesFor filters by place', () => {
  assert.deepEqual(notesFor(sampleLog, 'jiufen-gold-mountain').map(e => e.id), ['a']);
});
