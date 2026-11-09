// app/js/main.js and guide updates, driven in the fake browser (tests/fake-dom.js): log entries keep their
// place's name (labels: at start for entries logged before labels, when logging, and from the old guide when an
// update arrives), and the 'data-updated' toast names the logged or planned places the new guide dropped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const CHIHKAN = { en: 'Chihkan Tower (Fort Provintia)', zh_TW: '赤崁樓' };
const JIUFEN = { en: 'Jiufen Old Street & Jinguashi Gold Mountain', zh_TW: '九份山城與金瓜石礦業遺址' };
const LUKANG = { en: 'Lukang Longshan Temple', zh_TW: '鹿港龍山寺' };

const dom = installDom({ hash: '#/explore', guidebook });
// Stored before the app starts: a note logged before entries kept a label, and a plan with a guidebook stop
dom.store.set('tg.log.v1', JSON.stringify([
  { id: 'old', date: '2026-11-03', placeId: 'chihkan-tower', name: '', stars: 4, note: 'great' },
  { id: 'free', date: '2026-11-03', placeId: null, name: 'Curry shop', stars: null, note: 'too salty' },
]));
dom.store.set('tg.trip.v1', JSON.stringify({ title: 'Test plan', days: [
  { date: '2026-11-05', items: [{ place: 'jiufen-gold-mountain', time: '09:00' }, { name: 'Lunch' }] },
] }));

// The service worker's messages reach main.js through navigator.serviceWorker
/** @type {Function[]} */
const swListeners = [];
navigator.serviceWorker = { register: async () => ({}), addEventListener: (type, fn) => type === 'message' && swListeners.push(fn) };

const { state } = await import('../../app/js/state.js');
const { tr } = await import('../../app/js/lang.js');
const { LOG_KEY, emptyDraft } = await import('../../app/js/triplog.js');
await import('../../app/js/main.js');
await settle();

const toastText = () => dom.document.getElementById('toast').textContent;
const stored = () => JSON.parse(dom.store.get(LOG_KEY));
const go = async hash => { dom.location.hash = hash; await settle(); };
const without = (...ids) => ({ ...structuredClone(guidebook), places: guidebook.places.filter(p => !ids.includes(p.id)) });
/** The service worker says guidebook.json changed; the page then fetches `next`. */
const update = async next => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => structuredClone(next) });
  for (const fn of swListeners) await fn({ data: { type: 'data-updated' } });
  await settle();
};

test('at start, a note logged before labels gets its place name, and is stored with it', () => {
  assert.deepEqual(state.log.map(e => e.label), [CHIHKAN, undefined]);
  assert.deepEqual(stored().map(e => e.label), [CHIHKAN, undefined]);
});

test('a new note for a guidebook place is stored with the place name', async () => {
  state.draft = { ...emptyDraft('2026-11-04'), placeId: 'lukang-longshan-temple', stars: 5 };
  dom.view.listeners.submit[0]({ target: { dataset: { form: 'log' } }, preventDefault() {} });
  await settle();
  assert.equal(toastText(), tr('en', 'saved'));
  assert.deepEqual(stored().at(-1).label, LUKANG);
});

test('an update that drops a logged and a planned place names both in the toast', async () => {
  state.lang = 'en';
  await update(without('chihkan-tower', 'jiufen-gold-mountain'));
  assert.equal(toastText(), `Guide updated: ${CHIHKAN.en}, ${JIUFEN.en} are no longer in the guide.`);
  assert.equal(state.data.places.some(p => p.id === 'chihkan-tower'), false, 'the new guide is in use');
});

test('My trip then names the dropped place from its label, without a link, marked as gone', async () => {
  await go('#/log');
  const html = dom.view.innerHTML;
  assert.ok(html.includes(CHIHKAN.en));
  assert.ok(!html.includes('href="#/place/chihkan-tower"'), 'no link to a page that is gone');
  assert.ok(html.includes(tr('en', 'notInGuide')));
  assert.ok(html.includes('href="#/place/lukang-longshan-temple"'), 'a place still in the guide is still a link');
});

test('a note without a label, whose place an update drops, takes its name from the old guide', async () => {
  // e.g. imported from a file written before labels
  state.log = [...state.log, { id: 'imp', date: '2026-11-04', placeId: 'dadaocheng-dihua-street', name: '', stars: 3, note: '' }];
  state.lang = 'zh_TW';
  await update(without('chihkan-tower', 'jiufen-gold-mountain', 'dadaocheng-dihua-street', 'lukang-longshan-temple'));
  // in the order of the log
  assert.equal(toastText(), `手冊已更新：${LUKANG.zh_TW}、大稻埕迪化街歷史街區已不在手冊中。`);
  const imp = stored().find(e => e.id === 'imp');
  assert.deepEqual(imp.label, { en: 'Dadaocheng Dihua Street Historic District', zh_TW: '大稻埕迪化街歷史街區' });
  const html = dom.view.innerHTML;
  assert.ok(html.includes('大稻埕迪化街歷史街區') && html.includes(LUKANG.zh_TW) && html.includes(CHIHKAN.zh_TW));
  // three notes, and the plan's stop at Jiufen (trip view)
  assert.equal(html.split(`<span class="badge warm">${tr('zh_TW', 'notInGuide')}</span>`).length - 1, 4);
});

test('an update that drops none of the traveller\'s places shows the plain message', async () => {
  state.lang = 'en';
  dom.document.getElementById('toast').textContent = '';
  await update(without('chihkan-tower', 'jiufen-gold-mountain', 'dadaocheng-dihua-street', 'lukang-longshan-temple', 'fort-san-domingo'));
  assert.equal(state.data.places.some(p => p.id === 'fort-san-domingo'), false);
  assert.equal(toastText(), tr('en', 'guideUpdated'));
});

test('an update that cannot be fetched keeps the current guide and says nothing', async () => {
  const before = state.data;
  dom.document.getElementById('toast').textContent = '';
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  for (const fn of swListeners) await fn({ data: { type: 'data-updated' } });
  await settle();
  assert.equal(state.data, before);
  assert.equal(toastText(), '');
});
