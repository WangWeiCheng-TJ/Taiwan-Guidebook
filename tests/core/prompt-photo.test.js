// "Ask AI about a photo": buildPhotoPrompt (prompt.js), nextStop (trip.js) and nowTime (util.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPhotoPrompt, PHOTO_KINDS } from '../../app/js/prompt.js';
import { nextStop, parseTrip, tripBlock } from '../../app/js/trip.js';
import { nowTime } from '../../app/js/util.js';
import { places, chihkan } from '../fixtures.js';

const trip = parseTrip(JSON.parse(readFileSync(new URL('../../docs/sample-trip.json', import.meta.url), 'utf8'))).trip;
const temple = places.find(p => p.id === 'tainan-confucius-temple');
const DAY = '2026-11-04'; // the sample trip's Tainan day: 09:00 Chihkan Tower, 10:30 Confucius Temple, 12:30 lunch

/** @returns {import('../../app/js/types.js').PhotoContext} */
const ctx = (over = {}) => ({ pos: null, places, today: DAY, time: '08:00', trip: null, party: null, ...over });
const paras = p => p.split('\n\n');
const atChihkan = { ...chihkan.location.coordinates, source: 'gps', label: 'your location' };
const hotpot = { city_en: 'Tainan City', city_zh: '臺南市', name: '小豪洲沙茶火鍋', dish: { en: 'Satay hot pot', zh_TW: '沙茶火鍋' },
  hint: { en: 'For meat, the pork is the better choice.', zh_TW: '肉類建議點豬肉。' } };

// ---------- nowTime ----------

test('nowTime: local HH:MM, zero-padded', () => {
  assert.equal(nowTime(new Date(2026, 10, 4, 9, 5)), '09:05');
  assert.equal(nowTime(new Date(2026, 10, 4, 23, 59)), '23:59');
  assert.equal(nowTime(new Date(2026, 10, 4, 0, 0)), '00:00');
  assert.match(nowTime(), /^\d\d:\d\d$/);
});

// ---------- nextStop ----------

test('nextStop: the stop after the last one whose time has passed', () => {
  assert.equal(nextStop(trip, places, DAY, '08:00').place.id, 'chihkan-tower', 'nothing passed yet: the first stop');
  assert.equal(nextStop(trip, places, DAY, '09:00').place.id, 'chihkan-tower', 'a stop at this very minute is still ahead');
  const s = nextStop(trip, places, DAY, '09:30');
  assert.equal(s.place.id, 'tainan-confucius-temple');
  assert.equal(s.label, temple.name.en);
  assert.equal(s.item.time, '10:30');
  const lunch = nextStop(trip, places, DAY, '12:00');
  assert.equal(lunch.place, null);
  assert.equal(lunch.label, 'Lunch: beef soup or milkfish congee nearby');
  assert.equal(nextStop(trip, places, DAY, '13:00'), null, 'every stop is behind');
});

test('nextStop: untimed stops count once a later timed stop has passed', () => {
  const t = { title: 'x', days: [{ date: DAY, items: [{ time: '09:00', name: 'A' }, { name: 'B' }, { time: '14:00', name: 'C' }] }] };
  assert.equal(nextStop(t, places, DAY, '08:00').label, 'A');
  assert.equal(nextStop(t, places, DAY, '12:00').label, 'B');
  assert.equal(nextStop(t, places, DAY, '15:00'), null);
});

test('nextStop: null without a day, a timed stop or a valid time', () => {
  const untimed = { title: 'x', days: [{ date: DAY, items: [{ name: 'A' }, { name: 'B' }] }] };
  assert.equal(nextStop(untimed, places, DAY, '08:00'), null, 'nothing tells where the traveler is in the day');
  assert.equal(nextStop(trip, places, '2026-12-01', '08:00'), null);
  assert.equal(nextStop(null, places, DAY, '08:00'), null);
  assert.equal(nextStop(trip, places, DAY, '9:00'), null);
  assert.equal(nextStop(trip, places, DAY, ''), null);
});

// ---------- buildPhotoPrompt: shared paragraphs ----------

test('PHOTO_KINDS: the five presets in display order', () => {
  assert.deepEqual([...PHOTO_KINDS], ['menu', 'sign', 'board', 'machine', 'label']);
});

test('first paragraph tells the traveler to attach the photo, in the UI language', () => {
  assert.equal(paras(buildPhotoPrompt(ctx(), 'menu', 'en'))[0], '(Attach your photo to this message before you send it.)');
  assert.equal(paras(buildPhotoPrompt(ctx(), 'menu', 'zh_TW'))[0], '（送出前，請先把照片附在這則訊息裡。）');
  assert.equal(paras(buildPhotoPrompt(ctx(), 'menu'))[0], '(Attach your photo to this message before you send it.)', 'en by default');
});

test('who and when: the time when given, the party only when set', () => {
  assert.equal(paras(buildPhotoPrompt(ctx(), 'sign'))[1], "I'm a visitor traveling in Taiwan. Today is 2026-11-04, 08:00.");
  assert.equal(paras(buildPhotoPrompt(ctx({ time: undefined }), 'sign'))[1], "I'm a visitor traveling in Taiwan. Today is 2026-11-04.");
  assert.equal(paras(buildPhotoPrompt(ctx({ party: 3 }), 'sign'))[1], "I'm a visitor traveling in Taiwan. Today is 2026-11-04, 08:00. We are 3 people.");
  assert.match(paras(buildPhotoPrompt(ctx({ party: 1 }), 'sign'))[1], / I'm traveling alone\.$/);
  assert.doesNotMatch(buildPhotoPrompt(ctx({ party: null }), 'menu'), /We are|traveling alone/);
});

test('where: near a guidebook place, in or near a city, GPS only, a picked city, or nothing', () => {
  const where = pos => paras(buildPhotoPrompt(ctx({ pos }), 'sign'))[1];
  const { district_en: d, city_en: c } = chihkan.location;
  assert.ok(where(atChihkan).endsWith(` I'm at GPS ${atChihkan.lat.toFixed(3)}, ${atChihkan.lng.toFixed(3)}, near ${chihkan.name.en} (${chihkan.name.zh_TW}) in ${d}, ${c}.`));
  assert.ok(where({ lat: 22.95, lng: 120.2, source: 'gps', label: '' }).endsWith(" I'm at GPS 22.950, 120.200, in or near Tainan City."), 'about 4.5 km out');
  assert.ok(where({ lat: 22.75, lng: 121.15, source: 'gps', label: '' }).endsWith(" I'm at GPS 22.750, 121.150."), 'Taitung: no guidebook place within 15 km');
  assert.ok(where({ lat: 22.99, lng: 120.2, source: 'pick', label: 'Tainan City', city: 'Tainan City' }).endsWith(" I'm somewhere in Tainan City."));
  assert.ok(where(null).endsWith('08:00.'));
});

test('the traveler\'s note comes before the closing lines; a blank note adds nothing', () => {
  const p = buildPhotoPrompt(ctx({ note: '  Allergic to shellfish ' }), 'menu', 'zh_TW');
  const list = paras(p);
  assert.equal(list[list.length - 3], 'Also keep in mind: Allergic to shellfish');
  assert.doesNotMatch(buildPhotoPrompt(ctx({ note: '   ' }), 'menu'), /keep in mind/);
  assert.doesNotMatch(buildPhotoPrompt(ctx(), 'menu'), /keep in mind/);
});

test('every kind: what the photo shows, a numbered list, no guessing at unreadable parts, reply language', () => {
  const shows = { menu: 'a menu', sign: 'a sign or notice', board: 'a departure board or timetable',
    machine: 'a ticket machine or a form', label: 'a food label or ingredient list' };
  for (const k of PHOTO_KINDS) {
    const p = buildPhotoPrompt(ctx(), k, 'en');
    assert.match(p, new RegExp(`\\n\\nThe attached photo shows ${shows[k]}\\. Please:\\n1\\. `), k);
    assert.match(p, /say what you can't read instead of guessing\. If no photo is attached, ask me for it\.$/, k);
    assert.doesNotMatch(p, /Traditional Chinese/, k);
    assert.match(buildPhotoPrompt(ctx(), k, 'zh_TW'), /\n\nPlease reply in Traditional Chinese \(Taiwan\)\.$/, k);
  }
});

test('an unknown kind is read as a menu; the context is not changed', () => {
  const c = ctx({ trip, party: 2, shop: hotpot });
  const before = structuredClone(c);
  assert.equal(buildPhotoPrompt(c, /** @type {any} */ ('poster')), buildPhotoPrompt(c, 'menu'));
  assert.deepEqual(c, before);
  assert.equal(buildPhotoPrompt(c, 'menu'), buildPhotoPrompt(c, 'menu'), 'same input, same output');
});

// ---------- menu ----------

test('menu: every item in Chinese and English, the flags, an order for the party with a cost, what to point at', () => {
  const p = buildPhotoPrompt(ctx({ party: 3 }), 'menu');
  assert.ok(p.includes('1. List every item on the menu, in its order: the Chinese exactly as written, an English name, the price if shown, and in a few words what it is'));
  for (const f of ['pork', 'beef', 'seafood', 'offal', 'blood', 'peanuts']) assert.match(p, new RegExp(`2\\. Flag each item that has or may have [^\\n]*\\b${f}\\b`), f);
  assert.match(p, /mark the item "ask the staff" instead of guessing/);
  assert.ok(p.includes('3. Suggest an order for the 3 of us, with an estimated total cost in NT$.'));
  assert.ok(p.includes('4. For each suggested item, give the exact Chinese to point at on the menu'));
  assert.match(p, /5\. If the menu shows how ordering works here/);
  assert.ok(buildPhotoPrompt(ctx({ party: 1 }), 'menu').includes('Suggest an order for me alone,'));
  assert.ok(buildPhotoPrompt(ctx(), 'menu').includes('Suggest an order for one person (and say how to scale it for more people),'), 'party not set');
});

test('menu at a food pick: the shop, its dish and tip instead of the GPS line; the dish is looked for', () => {
  const p = buildPhotoPrompt(ctx({ pos: atChihkan, shop: hotpot }), 'menu');
  assert.equal(paras(p)[1], "I'm a visitor traveling in Taiwan. Today is 2026-11-04, 08:00.", 'the shop says where');
  assert.equal(paras(p)[2], "I'm at 小豪洲沙茶火鍋, a place to eat in Tainan City (臺南市) that a local friend recommends. Recommended here: Satay hot pot (沙茶火鍋). Their tip: For meat, the pork is the better choice.");
  assert.ok(p.includes('\n3. Find the recommended dish (沙茶火鍋) on the menu and include it in the order.\n4. Suggest an order'));

  const plain = buildPhotoPrompt(ctx({ shop: { city_en: 'Tainan City', city_zh: '臺南市', name: '入街' } }), 'menu');
  assert.equal(paras(plain)[2], "I'm at 入街, a place to eat in Tainan City (臺南市) that a local friend recommends.");
  assert.doesNotMatch(plain, /Find the/);
});

test('menu for a dish with no shop chosen: the dish to try', () => {
  const p = buildPhotoPrompt(ctx({ shop: { city_en: 'Tainan City', city_zh: '臺南市', dish: { en: 'Milkfish', zh_TW: '虱目魚' } } }), 'menu');
  assert.equal(paras(p)[2], "I'm in Tainan City (臺南市) to try a local dish: Milkfish (虱目魚).");
  assert.ok(p.includes('3. Find the dish I want to try (虱目魚) on the menu and include it in the order.'));
});

test('the next stop of today\'s plan is named for every kind, after the shop', () => {
  const next = `My next stop: ${temple.name.en} (${temple.name.zh_TW}), ${temple.location.district_en}, ${temple.location.city_en}, planned for 10:30.`;
  const p = buildPhotoPrompt(ctx({ trip, time: '09:30', shop: hotpot }), 'menu');
  assert.equal(paras(p)[3], next);
  assert.doesNotMatch(p, /My plan for/, 'the whole day only for a board');
  assert.ok(buildPhotoPrompt(ctx({ trip, time: '12:00' }), 'sign').includes('\n\nMy next stop: Lunch: beef soup or milkfish congee nearby, planned for 12:30.\n\n'));
  assert.doesNotMatch(buildPhotoPrompt(ctx({ trip, time: undefined }), 'menu'), /My next stop/, 'no time: unknown');
  assert.doesNotMatch(buildPhotoPrompt(ctx({ trip, today: '2026-12-01' }), 'menu'), /My next stop/, 'no plan today');
});

// ---------- board ----------

test('board: today\'s plan, the next stop, and which departure to take to it', () => {
  const p = buildPhotoPrompt(ctx({ trip, time: '09:30' }), 'board');
  const list = paras(p);
  assert.equal(list[2], tripBlock(trip, places, DAY));
  assert.match(list[3], /^My next stop: Tainan Confucius Temple/);
  assert.ok(list[4].includes('\n1. Read it: for each departure shown, the time, the line or train number'));
  assert.ok(list[4].includes('\n2. Tell me which departure to take to reach my next stop: line, platform and time, whether I need to change, and roughly how long the ride takes.'));
  assert.match(list[4], /\n3\. Tell me if the kind of ticket matters/);
  assert.match(list[4], /\n4\. Point out anything unusual on the board/);
});

test('board: with every stop behind, the next unvisited stop of the plan; without a plan, ask where to', () => {
  const late = buildPhotoPrompt(ctx({ trip, time: '13:00' }), 'board');
  assert.ok(late.includes(tripBlock(trip, places, DAY)));
  assert.doesNotMatch(late, /My next stop/);
  assert.match(late, /2\. Tell me which departure to take to reach the next stop on my plan that I haven't been to yet: .*If you can't tell which stop that is, ask me\./);
  const none = buildPhotoPrompt(ctx(), 'board');
  assert.doesNotMatch(none, /My plan for|My next stop/);
  assert.match(none, /2\. If you don't know where I'm going, ask me\. Then tell me which departure to take: line, platform and time/);
});

// ---------- sign, machine, label ----------

test('sign: translated line by line, what it means for a visitor, what to do', () => {
  const p = buildPhotoPrompt(ctx(), 'sign');
  assert.ok(p.includes('1. Translate all of the text, line by line: the Chinese as written, then English.'));
  assert.match(p, /2\. Say in one or two sentences what it means for me as a visitor/);
  assert.match(p, /3\. Tell me whether I need to do anything/);
  assert.match(p, /4\. List any times, dates, prices, phone numbers or addresses on it\./);
});

test('machine: every button translated, step by step for the party, forms, payment', () => {
  const p = buildPhotoPrompt(ctx({ party: 2 }), 'machine');
  assert.ok(p.includes('1. Translate every button, option and field: the Chinese as written, then English.'));
  assert.ok(p.includes('2. Walk me through it step by step: what to press, choose or write, in order, for the 2 of us.'));
  assert.ok(buildPhotoPrompt(ctx({ party: 1 }), 'machine').includes('in order, for me alone.'));
  assert.ok(buildPhotoPrompt(ctx(), 'machine').includes('in order (ask me how many tickets if it matters).'));
  assert.match(p, /3\. For a form: what to write in each field/);
  assert.match(p, /4\. Say what payment it takes/);
});

test('label: what it is, the full ingredient list, the same flags plus listed allergens', () => {
  const p = buildPhotoPrompt(ctx(), 'label');
  assert.match(p, /1\. Tell me what the product is, in English/);
  assert.ok(p.includes('2. Translate the full ingredient list.'));
  for (const f of ['pork', 'beef', 'seafood', 'offal', 'blood', 'peanuts']) assert.match(p, new RegExp(`3\\. Flag any [^\\n]*\\b${f}\\b`), f);
  assert.match(p, /any allergens the label lists/);
  assert.match(p, /mark it "unclear"/);
  assert.match(p, /4\. Give the best-before or expiry date/);
});
