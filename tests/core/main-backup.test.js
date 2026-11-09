// The backup in app/js/main.js, driven in the fake browser (tests/fake-dom.js): Export shares the version 2 file
// where the browser can share files and downloads it elsewhere; Import still takes version 1 files and bare
// arrays, loads a plan (asking before it replaces a different one) and a party size the phone never set; the
// mark under tg.backup.v1 feeds the "Last backup" line; the browser is asked once to keep the storage.
// The stay and the plans here are made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/explore', guidebook });
const notes = [
  { id: 'n1', date: '2026-11-03', placeId: null, name: 'Tea shop', stars: 4, note: 'good' },
  { id: 'n2', date: '2026-11-04', placeId: null, name: 'Night market', stars: null, note: 'busy' },
];
dom.store.set('tg.log.v1', JSON.stringify(notes));
dom.store.set('tg.stay.v1', JSON.stringify([{ id: 's', name: '範例旅店', address: '臺南市中西區範例路1號', phone: '06-221-0000', city: '' }]));

// Storage Manager: persist() is counted
let persistCalls = 0;
navigator.storage = { persisted: async () => false, persist: async () => { persistCalls++; return true; } };

const { state } = await import('../../app/js/state.js');
const { tr } = await import('../../app/js/lang.js');
const { today } = await import('../../app/js/util.js');
const { EXPORT_TYPE } = await import('../../app/js/triplog.js');
await import('../../app/js/main.js');
await settle();

const planA = { title: 'Plan A', days: [{ date: '2026-11-05', items: [{ place: 'chihkan-tower', time: '09:00' }] }] };
const planB = { title: 'Plan B', days: [{ date: '2026-11-06', items: [{ name: 'Tamsui sunset' }] }] };

const toastText = () => dom.document.getElementById('toast').textContent;
const stored = key => JSON.parse(dom.store.get(key) ?? 'null');
const go = async hash => { dom.location.hash = hash; await settle(); };
const click = dataset => dom.view.listeners.click[0]({ target: dom.control(dataset), preventDefault() {} });
const saveNote = name => {
  state.draft = { date: '', placeId: '', name, stars: 3, note: '' };
  dom.view.listeners.submit[0]({ target: { dataset: { form: 'log' } }, preventDefault() {} });
};
/** Choose a file in the hidden Import input. */
const importFile = async content => {
  const input = { dataset: { change: 'import' }, value: 'C:\\fakepath\\backup.json',
    files: [{ text: async () => (typeof content === 'string' ? content : JSON.stringify(content)) }] };
  await dom.view.listeners.change[0]({ target: input });
  await settle();
  assert.equal(input.value, '', 'the same file can be chosen again');
};
/** @type {string[]} */
let asked = [];
let answer = true;
globalThis.confirm = msg => { asked.push(msg); return answer; };

/** Export with share and download watched. */
async function exportNow() {
  /** @type {Blob[]} */
  const downloads = [];
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = b => { downloads.push(b); return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  click({ action: 'export' });
  await settle();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  return downloads;
}

test('My trip says there is no backup yet and counts the notes', async () => {
  assert.equal(state.backup, null);
  await go('#/log');
  assert.match(dom.view.innerHTML, /<p class="small">No backup yet · 2 notes<\/p>/);
});

test('the first saved note asks the browser to keep the storage, once', async () => {
  saveNote('Bakery');
  await settle();
  assert.equal(persistCalls, 1);
  saveNote('Temple fair');
  await settle();
  assert.equal(persistCalls, 1, 'not again');
  assert.equal(state.backup, null, 'no mark before the first backup');
  assert.match(dom.view.innerHTML, /No backup yet · 4 notes/);
});

test('Import: a version 1 file and a bare array still add their notes; nothing else changes', async () => {
  await importFile({ type: EXPORT_TYPE, exported_at: '2026-11-04T00:00:00.000Z', entries: [{ ...notes[0], id: 'v1' }] });
  assert.equal(toastText(), tr('en', 'imported', { n: 1 }));
  await importFile([{ ...notes[0], id: 'bare' }]);
  assert.equal(toastText(), tr('en', 'imported', { n: 1 }));
  assert.deepEqual(stored('tg.log.v1').map(e => e.id).slice(-2), ['v1', 'bare']);
  assert.equal(state.trip, null);
  assert.equal(state.partySet, false);
  assert.deepEqual(asked, []);
  await importFile('not json');
  assert.equal(toastText(), tr('en', 'badImport'));
  await importFile({ hello: 1 });
  assert.equal(toastText(), tr('en', 'badImport'));
});

test('Import version 2 with no plan on the phone: the plan loads without asking, and the party size', async () => {
  await importFile({ type: EXPORT_TYPE, version: 2, exported_at: '2026-11-04T00:00:00.000Z', entries: [], trip: planA, party: 5 });
  assert.deepEqual(asked, []);
  assert.equal(state.trip.title, 'Plan A');
  assert.deepEqual(stored('tg.trip.v1'), state.trip);
  assert.equal(toastText(), `${tr('en', 'imported', { n: 0 })} ${tr('en', 'planLoaded', { t: 'Plan A' })}`);
  assert.equal(state.party, 5);
  assert.equal(state.partySet, true);
  assert.equal(stored('tg.party.v1'), 5);
});

test('Import version 2: the same plan is not asked about; a party set on this phone is kept', async () => {
  click({ action: 'party-dec' }); // the traveller sets 4 here
  await importFile({ type: EXPORT_TYPE, version: 2, entries: [], trip: planA, party: 7 });
  assert.deepEqual(asked, []);
  assert.equal(toastText(), tr('en', 'imported', { n: 0 }));
  assert.equal(state.party, 4);
  assert.equal(stored('tg.party.v1'), 4);
});

test('Import version 2 with a different plan: asks first; No keeps the plan but adds the notes', async () => {
  answer = false;
  await importFile({ type: EXPORT_TYPE, version: 2, entries: [{ ...notes[0], id: 'n9' }], trip: planB, party: null });
  assert.deepEqual(asked, [tr('en', 'backup.planConfirm', { t: 'Plan B', old: 'Plan A' })]);
  assert.equal(state.trip.title, 'Plan A');
  assert.equal(stored('tg.trip.v1').title, 'Plan A');
  assert.ok(state.log.some(e => e.id === 'n9'));
  assert.equal(toastText(), tr('en', 'imported', { n: 1 }));

  asked = [];
  answer = true;
  await importFile({ type: EXPORT_TYPE, version: 2, entries: [], trip: planB, party: null });
  assert.equal(asked.length, 1);
  assert.equal(state.trip.title, 'Plan B');
  assert.equal(stored('tg.trip.v1').title, 'Plan B');
  assert.match(toastText(), /Plan loaded: Plan B/);
  asked = [];
});

test('Import version 2 with a damaged plan: the notes come in, the plan stays, the toast says so', async () => {
  await importFile({ type: EXPORT_TYPE, version: 2, entries: [{ ...notes[0], id: 'n10' }], trip: { title: 'x', days: [] } });
  assert.deepEqual(asked, []);
  assert.equal(state.trip.title, 'Plan B');
  assert.equal(toastText(), `${tr('en', 'imported', { n: 1 })} ${tr('en', 'backup.badPlan')}`);
});

test('Export where the browser cannot share files: downloads version 2 with notes, plan and party, never My stay', async () => {
  const downloads = await exportNow();
  assert.equal(downloads.length, 1);
  const file = JSON.parse(await downloads[0].text());
  assert.equal(file.type, EXPORT_TYPE);
  assert.equal(file.version, 2);
  assert.deepEqual(file.entries, state.log);
  assert.deepEqual(file.trip, state.trip);
  assert.equal(file.party, 4);
  const text = JSON.stringify(file);
  for (const v of ['範例旅店', '範例路', '06-221-0000']) assert.ok(!text.includes(v), v);
  assert.doesNotMatch(text, /tg\.stay|"stays"/);
});

test('the export leaves a mark: My trip says the backup was today, then counts notes since', async () => {
  assert.equal(state.backup.since, 0);
  assert.deepEqual(stored('tg.backup.v1'), state.backup);
  assert.equal(Date.parse(state.backup.at) <= Date.now(), true);
  assert.match(dom.view.innerHTML, /<p class="small">Last backup today · no new notes since<\/p>/);
  saveNote('Dumplings');
  assert.equal(stored('tg.backup.v1').since, 1);
  assert.match(dom.view.innerHTML, /Last backup today · 1 note since/);
  await importFile([{ ...notes[0], id: 'n11' }, { ...notes[0], id: 'n12' }]);
  assert.equal(stored('tg.backup.v1').since, 3, 'imported notes count too');
  await importFile([{ ...notes[0], id: 'n11' }]);
  assert.equal(stored('tg.backup.v1').since, 3, 'nothing new: no change');
});

test('Export where the browser can share files: the share sheet gets the file, no download', async () => {
  /** @type {any[]} */
  const shared = [];
  navigator.canShare = data => Array.isArray(data?.files) && data.files.length === 1;
  navigator.share = async data => { shared.push(data); };
  const downloads = await exportNow();
  assert.equal(downloads.length, 0);
  assert.equal(shared.length, 1);
  const [f] = shared[0].files;
  assert.equal(f.name, `taiwan-trip-log-${today()}.json`);
  assert.equal(f.type, 'application/json');
  assert.equal(shared[0].title, tr('en', 'backup.shareTitle', { d: today() }));
  const file = JSON.parse(await f.text());
  assert.equal(file.version, 2);
  assert.equal(file.trip.title, 'Plan B');
  assert.equal(state.backup.since, 0, 'a new mark');
});

test('a cancelled share is no backup; a share that fails otherwise downloads instead', async () => {
  saveNote('Shaved ice');
  const before = state.backup;
  assert.equal(before.since, 1);
  navigator.share = async () => { throw new DOMException('Share canceled', 'AbortError'); };
  assert.equal((await exportNow()).length, 0, 'no download');
  assert.equal(state.backup, before, 'the mark is unchanged');
  assert.equal(stored('tg.backup.v1').since, 1);

  navigator.share = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
  assert.equal((await exportNow()).length, 1, 'downloaded');
  assert.equal(state.backup.since, 0);
  delete navigator.share;
  delete navigator.canShare;
});

test('the Chinese UI says the same', async () => {
  dom.document.getElementById('lang-toggle').listeners.click[0]();
  assert.match(dom.view.innerHTML, /上次備份：今天 · 之後沒有新筆記/);
  dom.document.getElementById('lang-toggle').listeners.click[0]();
});

test('the storage was asked to persist only once in all of this', () => {
  assert.equal(persistCalls, 1);
});
