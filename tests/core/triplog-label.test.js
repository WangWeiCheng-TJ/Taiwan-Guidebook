// The trip log survives guide updates: an entry for a guidebook place keeps the place's name (label), the log
// names a place the guide dropped without a link, labels go through export and import, and a guide update can
// say which of the traveller's places it dropped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../app/js/state.js';
import { tr } from '../../app/js/lang.js';
import {
  makeEntry, entryName, placeGone, withLabels, mergeImport, exportPayload, trackedIds, goneFromGuide,
  guideUpdatedMessage, GONE_NAMED, emptyDraft,
} from '../../app/js/triplog.js';
import { logBlock } from '../../app/js/prompt.js';
import { renderLog } from '../../app/js/views/log.js';
import { guidebook, places } from '../fixtures.js';

state.data = guidebook;
const CHIHKAN = { en: 'Chihkan Tower (Fort Provintia)', zh_TW: '赤崁樓' };
const DADAOCHENG = { en: 'Dadaocheng Dihua Street Historic District', zh_TW: '大稻埕迪化街歷史街區' };
const without = (...ids) => places.filter(p => !ids.includes(p.id));
const draft = over => ({ date: '2026-11-03', placeId: '', name: '', stars: 4, note: '', ...over });
const entry = over => ({ id: 'x', date: '2026-11-03', placeId: 'chihkan-tower', name: '', stars: 4, note: '', ...over });

// ---------- makeEntry ----------

test('makeEntry keeps the name of the place in both languages', () => {
  const e = makeEntry(draft({ placeId: 'chihkan-tower', name: 'ignored' }), 'a', '2026-11-04', places);
  assert.deepEqual(e, { id: 'a', date: '2026-11-03', placeId: 'chihkan-tower', name: '', stars: 4, note: '', label: CHIHKAN });
});

test('makeEntry: no label for a typed name, an unknown place, or without the guidebook', () => {
  assert.equal('label' in makeEntry(draft({ name: 'Curry' }), 'a', '2026-11-04', places), false);
  assert.equal('label' in makeEntry(draft({ placeId: 'no-such-place' }), 'a', '2026-11-04', places), false);
  assert.equal('label' in makeEntry(draft({ placeId: 'chihkan-tower' }), 'a', '2026-11-04'), false);
});

// ---------- entryName, placeGone ----------

test('entryName: the guide name while the place is there, in the language asked', () => {
  const e = entry({ label: { en: 'Old English name', zh_TW: '舊名' } });
  assert.equal(entryName(e, places), CHIHKAN.en);
  assert.equal(entryName(e, places, 'zh_TW'), CHIHKAN.zh_TW);
  assert.equal(entryName(e, places, 'en'), CHIHKAN.en);
});

test('entryName: a place the guide dropped is named from its label, then the typed name, then its id', () => {
  const gone = without('chihkan-tower');
  const e = entry({ label: CHIHKAN });
  assert.equal(entryName(e, gone), CHIHKAN.en);
  assert.equal(entryName(e, gone, 'zh_TW'), CHIHKAN.zh_TW);
  assert.equal(entryName(entry({ label: { en: 'Only English', zh_TW: '' } }), gone, 'zh_TW'), 'Only English');
  assert.equal(entryName(entry({ label: { en: '', zh_TW: '只有中文' } }), gone, 'en'), '只有中文');
  // entries logged before labels existed keep working
  assert.equal(entryName(entry({ name: 'Typed' }), gone, 'zh_TW'), 'Typed');
  assert.equal(entryName(entry(), gone), 'chihkan-tower');
  assert.equal(entryName(entry(), gone, 'zh_TW'), 'chihkan-tower');
  // a free-text entry is still its typed name
  assert.equal(entryName(entry({ placeId: null, name: 'Curry shop' }), places, 'zh_TW'), 'Curry shop');
});

test('placeGone: only an entry whose place is not in this guide', () => {
  assert.equal(placeGone(entry(), places), false);
  assert.equal(placeGone(entry(), without('chihkan-tower')), true);
  assert.equal(placeGone(entry({ placeId: null, name: 'Curry' }), []), false);
});

test('the Ask AI log block names a dropped place by its label', () => {
  assert.match(logBlock([entry({ label: CHIHKAN, note: 'great' })], without('chihkan-tower')),
    /- 2026-11-03, Chihkan Tower \(Fort Provintia\): 4\/5, great/);
});

// ---------- withLabels ----------

test('withLabels labels entries logged before labels, and only those', () => {
  const log = [
    entry({ id: 'old' }),
    entry({ id: 'kept', placeId: 'dadaocheng-dihua-street', label: { en: 'Kept', zh_TW: '保留' } }),
    entry({ id: 'free', placeId: null, name: 'Curry' }),
    entry({ id: 'unknown', placeId: 'no-such-place' }),
  ];
  const copy = structuredClone(log);
  const out = withLabels(log, places);
  assert.deepEqual(out.map(e => e.label), [CHIHKAN, { en: 'Kept', zh_TW: '保留' }, undefined, undefined]);
  assert.deepEqual(log, copy, 'the log passed in is not changed');
  assert.equal(out[1], log[1], 'untouched entries are the same objects');
});

test('withLabels returns the same array when nothing changes', () => {
  const log = [entry({ label: CHIHKAN }), entry({ id: 'f', placeId: null, name: 'Curry' })];
  assert.equal(withLabels(log, places), log);
  assert.equal(withLabels([], places).length, 0);
  const old = [entry()];
  assert.equal(withLabels(old, without('chihkan-tower')), old, 'no label from a guide without the place');
});

// ---------- export and import ----------

test('a label goes through export and import', () => {
  const log = [makeEntry(draft({ placeId: 'chihkan-tower' }), 'a', '2026-11-03', places)];
  const parsed = JSON.parse(JSON.stringify(exportPayload(log, new Date('2026-11-04T00:00:00Z'))));
  assert.deepEqual(mergeImport([], parsed).log, log);
});

test('mergeImport keeps a valid label (trimmed, missing language as ""), and drops a bad one', () => {
  const { log } = mergeImport([], [
    entry({ id: 'a', label: { en: ' Coral Stone House ', zh_TW: '珊瑚石屋', extra: 1 } }),
    entry({ id: 'b', label: { en: 'English only' } }),
    entry({ id: 'c', label: { zh_TW: 7, en: '' } }),
    entry({ id: 'd', label: ['Coral', '珊瑚'] }),
    entry({ id: 'e', label: 'Coral Stone House' }),
    entry({ id: 'f', label: null }),
    entry({ id: 'g', placeId: null, name: 'Curry', label: { en: 'Not a place', zh_TW: '' } }),
  ]);
  assert.deepEqual(log.map(e => e.label), [
    { en: 'Coral Stone House', zh_TW: '珊瑚石屋' }, { en: 'English only', zh_TW: '' },
    undefined, undefined, undefined, undefined, undefined,
  ]);
  assert.deepEqual(log.map(e => 'label' in e), [true, true, false, false, false, false, false]);
});

// ---------- the traveller's places, and what an update dropped ----------

test('trackedIds: logged and planned guidebook places, each once', () => {
  const log = [entry({ id: 'a' }), entry({ id: 'b', placeId: null, name: 'Curry' }), entry({ id: 'c' })];
  const trip = { title: 'T', days: [
    { date: '2026-11-04', items: [{ place: 'dadaocheng-dihua-street' }, { name: 'Lunch' }, { place: 'chihkan-tower' }] },
    { date: '2026-11-05', items: [{ place: 'jiufen-gold-mountain', time: '09:00' }] },
  ] };
  assert.deepEqual(trackedIds(log, trip), ['chihkan-tower', 'dadaocheng-dihua-street', 'jiufen-gold-mountain']);
  assert.deepEqual(trackedIds(log, null), ['chihkan-tower']);
  assert.deepEqual(trackedIds([], { title: 'T', days: [{ date: '2026-11-04' }] }), []);
});

test('goneFromGuide names what the old guide had and the new one has not, from the old guide', () => {
  const ids = ['chihkan-tower', 'jiufen-gold-mountain', 'dadaocheng-dihua-street', 'never-there'];
  const after = without('chihkan-tower', 'dadaocheng-dihua-street');
  assert.deepEqual(goneFromGuide(ids, places, after, 'en'), [CHIHKAN.en, DADAOCHENG.en]);
  assert.deepEqual(goneFromGuide(ids, places, after, 'zh_TW'), [CHIHKAN.zh_TW, DADAOCHENG.zh_TW]);
  assert.deepEqual(goneFromGuide(ids, places, places, 'en'), []);
  assert.deepEqual(goneFromGuide([], places, [], 'en'), []);
});

test('guideUpdatedMessage: the plain message, or the places that are gone', () => {
  assert.equal(guideUpdatedMessage([], 'en'), tr('en', 'guideUpdated'));
  assert.equal(guideUpdatedMessage([], 'zh_TW'), tr('zh_TW', 'guideUpdated'));
  assert.equal(guideUpdatedMessage(['Coral Stone House'], 'en'), 'Guide updated: Coral Stone House is no longer in the guide.');
  assert.equal(guideUpdatedMessage(['A', 'B'], 'en'), 'Guide updated: A, B are no longer in the guide.');
  assert.equal(guideUpdatedMessage(['珊瑚石屋'], 'zh_TW'), '手冊已更新：珊瑚石屋已不在手冊中。');
  assert.equal(guideUpdatedMessage(['甲', '乙'], 'zh_TW'), '手冊已更新：甲、乙已不在手冊中。');
  assert.equal(GONE_NAMED, 3);
  assert.equal(guideUpdatedMessage(['A', 'B', 'C'], 'en'), 'Guide updated: A, B, C are no longer in the guide.');
  assert.equal(guideUpdatedMessage(['A', 'B', 'C', 'D', 'E'], 'en'), 'Guide updated: A, B, C and 2 more are no longer in the guide.');
  assert.equal(guideUpdatedMessage(['甲', '乙', '丙', '丁'], 'zh_TW'), '手冊已更新：甲、乙、丙和另外 1 個地方已不在手冊中。');
});

// ---------- My trip ----------

const s = over => ({ ...state, data: guidebook, draft: emptyDraft('2026-11-03'), trip: null, pasteOpen: false,
  tripDate: null, stays: [], ...over });

test('My trip: a place still in the guide is a link, with no marker; a typed name is plain text', () => {
  const out = renderLog(s({ lang: 'zh_TW', log: [entry({ label: { en: 'Old', zh_TW: '舊名' } }), entry({ id: 'f', placeId: null, name: 'Curry' })] }));
  assert.ok(out.includes(`<div class="title"><a href="#/place/chihkan-tower">${CHIHKAN.zh_TW}</a></div>`));
  assert.ok(out.includes('<div class="title">Curry</div>'));
  assert.ok(!out.includes(tr('zh_TW', 'notInGuide')));
});

test('My trip: a place the guide dropped keeps its name, is not a link, and says it is gone', () => {
  const log = [entry({ id: 'a', placeId: 'coral-stone-house', label: { en: 'Coral Stone House', zh_TW: '珊瑚石屋' } }),
    entry({ id: 'b', placeId: 'old-place', note: 'logged before labels' })];
  for (const L of ['en', 'zh_TW']) {
    const out = renderLog(s({ lang: L, log }));
    assert.ok(out.includes(L === 'en' ? 'Coral Stone House' : '珊瑚石屋'), L);
    assert.ok(out.includes('old-place'), `${L}: an entry without a label shows its id`);
    assert.ok(!out.includes('#/place/coral-stone-house') && !out.includes('#/place/old-place'), `${L}: no link to a missing page`);
    assert.equal(out.split(`<span class="badge warm">${tr(L, 'notInGuide')}</span>`).length - 1, 2, `${L}: both are marked`);
  }
  const html = renderLog(s({ lang: 'en', log: [entry({ placeId: 'gone', label: { en: '<b>&', zh_TW: '' } })] }));
  assert.ok(html.includes('&lt;b&gt;&amp; <span class="badge warm">'), 'the kept name is escaped');
  assert.notEqual(tr('zh_TW', 'notInGuide'), tr('en', 'notInGuide'));
});
