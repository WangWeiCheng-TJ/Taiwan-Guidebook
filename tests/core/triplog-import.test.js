// Imported log files are untrusted (hand-edited, rewritten by an AI): mergeImport reshapes entries to the
// LogEntry contract, and stars() never throws, so a bad file cannot break My trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeImport, removeEntry } from '../../app/js/triplog.js';
import { stars, isIsoDate } from '../../app/js/util.js';
import { renderLog } from '../../app/js/views/log.js';
import { emptyDraft } from '../../app/js/triplog.js';

const entry = over => ({ id: 'x', date: '2026-11-03', placeId: null, name: 'Curry', stars: 4, note: '', ...over });

test('mergeImport: stars outside 1..5 become null, fractional stars are rounded', () => {
  const { log, added } = mergeImport([], [
    entry({ id: 'a', stars: 8 }), entry({ id: 'b', stars: -1 }), entry({ id: 'c', stars: 0 }),
    entry({ id: 'd', stars: 4.6 }), entry({ id: 'e', stars: '4' }), entry({ id: 'f', stars: 3 }),
  ]);
  assert.equal(added, 6);
  assert.deepEqual(log.map(e => e.stars), [null, null, null, 5, null, 3]);
});

test('mergeImport: entries without a real YYYY-MM-DD date are skipped', () => {
  const { log, added } = mergeImport([], [
    entry({ id: 'a', date: '2026-11-3' }), entry({ id: 'b', date: '2026-11-31' }), entry({ id: 'c', date: 20261103 }),
    entry({ id: 'd', date: '2026-11-30' }),
  ]);
  assert.equal(added, 1);
  assert.deepEqual(log.map(e => e.id), ['d']);
});

test('mergeImport: text fields are strings, unknown fields are dropped, numeric ids become strings', () => {
  const { log } = mergeImport([], [{ id: 7, date: '2026-11-03', placeId: '', name: 42, note: null, stars: 2, extra: 'x' }]);
  assert.deepEqual(log, [{ id: '7', date: '2026-11-03', placeId: null, name: '', stars: 2, note: '' }]);
  assert.equal(removeEntry(log, '7').length, 0, 'the entry can be deleted by its (string) id');
  assert.equal(mergeImport([], [entry({ id: '' }), entry({ id: null }), 'junk', null]).added, 0);
});

test('stars() clamps instead of throwing', () => {
  assert.equal(stars(8), '★★★★★');
  assert.equal(stars(6), '★★★★★');
  assert.equal(stars(-1), '');
  assert.equal(stars(2.4), '★★☆☆☆');
  assert.equal(stars(5), '★★★★★');
  assert.equal(stars(undefined), '');
});

test('isIsoDate accepts real dates only', () => {
  for (const ok of ['2026-11-03', '2028-02-29', '2026-12-31']) assert.equal(isIsoDate(ok), true, ok);
  for (const bad of ['2026-11-31', '2026-13-01', '2026-02-29', '2026-11-3', '4 Nov', '', null, 20261103]) {
    assert.equal(isIsoDate(bad), false, String(bad));
  }
});

test('My trip renders after importing a file with an out-of-range rating', () => {
  const { log } = mergeImport([], [entry({ id: 'x1', stars: 8, note: 'great' })]);
  const s = { lang: 'en', draft: emptyDraft('2026-11-03'), log, trip: null, pasteOpen: false, tripDate: null };
  assert.doesNotThrow(() => renderLog(s));
  // A log saved before this fix may still hold such a rating: rendering must not throw either.
  assert.doesNotThrow(() => renderLog({ ...s, log: [entry({ id: 'old', stars: 8 })] }));
});

test('mergeImport: a file that repeats an id adds it once (the first copy)', () => {
  const { log, added } = mergeImport([], [entry({ id: '1', note: 'a' }), entry({ id: '1', date: '2026-11-04', note: 'b' })]);
  assert.equal(added, 1);
  assert.deepEqual(log.map(e => e.note), ['a']);
  assert.equal(removeEntry(log, '1').length, 0);
  // Still skips ids already in the log.
  assert.equal(mergeImport(log, [entry({ id: '1' }), entry({ id: '2' })]).added, 1);
});

test('mergeImport: an entry stored with a numeric id by an older import is not added again', () => {
  const log = [{ id: 7, date: '2025-01-01', placeId: null, name: 'x', stars: 3, note: '' }];
  const res = mergeImport(log, [{ id: 7, date: '2025-01-01', name: 'x', stars: 3 }, { id: '7', date: '2025-01-02', name: 'y', stars: 2 }]);
  assert.equal(res.added, 0);
  assert.equal(res.log.length, 1);
});

test('removeEntry: deletes an entry stored with a numeric id (the button gives its id as text)', () => {
  const log = [{ id: 7, date: '2025-01-01', placeId: null, name: 'x', stars: 3, note: '' },
    { id: '8', date: '2025-01-01', placeId: null, name: 'y', stars: 3, note: '' }];
  assert.deepEqual(removeEntry(log, '7').map(e => e.id), ['8']);
  assert.deepEqual(removeEntry(log, '8').map(e => e.id), [7]);
});
