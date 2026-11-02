// Every message a pure module can show as a toast has a Chinese version (trMsg).
import test from 'node:test';
import assert from 'node:assert/strict';
import { trMsg } from '../../app/js/lang.js';
import { parseTrip, loadTrip } from '../../app/js/trip.js';
import { planFromAiText } from '../../app/js/aiplan.js';
import { validateDraft } from '../../app/js/triplog.js';

// Pinned as an untranslated example by tests/core/lang.test.js ("trMsg translates known messages only").
const PINNED_ENGLISH = /: needs a place id or a name\.$/;

/** Every distinct message the pure modules produce for these bad inputs. */
async function allMessages() {
  const msgs = new Set();
  const add = list => list.forEach(m => msgs.add(m));
  add(parseTrip(null).errors);
  add(parseTrip({}).errors);
  add(parseTrip({ title: 'T', days: [1] }).errors);
  add(parseTrip({ title: 'T', days: [{ date: '4 Nov', items: 'none', title: 3 }] }).errors);
  add(parseTrip({ title: 'T', days: [{ date: '2026-11-04', items: [1, { place: 3, name: 4 }, { name: 'a', time: '9:00', note: 5 }] }] }).errors);
  const res = r => async () => r;
  add((await loadTrip('https://x.test/t.json', res({ ok: false, status: 404 }))).errors);
  add((await loadTrip('https://x.test/t.json', res({ ok: false }))).errors);
  add((await loadTrip('https://x.test/t.json', res({ ok: true, json: async () => { throw new Error('x'); } }))).errors);
  add((await loadTrip('https://x.test/t.json', async () => { throw new Error('offline'); })).errors);
  add(planFromAiText('no plan here', []).errors);
  add(planFromAiText('```json\n{ not json }\n```', []).errors);
  msgs.add(validateDraft({ date: '2026-11-04', placeId: '', name: '', stars: 0, note: '' }));
  msgs.add(validateDraft({ date: '2026-11-04', placeId: '', name: 'x', stars: 0, note: '' }));
  return [...msgs].filter(Boolean);
}

test('the bad inputs reach every kind of message', async () => {
  const msgs = await allMessages();
  for (const re of [/^The trip must be a JSON object\.$/, /^The trip must have a title\.$/, /^Day 1: date must be/,
    /^Day 1, stop 3: time must be HH:MM/, /\(HTTP 404\)/, /^Could not load the trip\.$/, /not valid JSON/, /Check your connection/]) {
    assert.ok(msgs.some(m => re.test(m)), `no message matches ${re}`);
  }
});

test('every message has a Chinese translation in the 中文 UI', async () => {
  const untranslated = (await allMessages()).filter(m => !PINNED_ENGLISH.test(m) && trMsg('zh_TW', m) === m);
  assert.deepEqual(untranslated, []);
});

test('templated messages keep their numbers', () => {
  assert.equal(trMsg('zh_TW', 'Day 1, stop 1: time must be HH:MM, like 09:30.'), '第 1 天第 1 站：時間必須是 HH:MM，例如 09:30。');
  assert.equal(trMsg('zh_TW', 'Day 12: date must be YYYY-MM-DD, like 2026-11-04.'), '第 12 天：日期必須是 YYYY-MM-DD，例如 2026-11-04。');
  assert.equal(trMsg('zh_TW', 'Could not load the trip (HTTP 404).'), '無法載入行程（HTTP 404）。');
  assert.equal(trMsg('zh_TW', 'The trip must have a title.'), '行程必須有標題（title）。');
});

test('English UI and unknown details stay as they are', () => {
  assert.equal(trMsg('en', 'Day 1, stop 1: time must be HH:MM, like 09:30.'), 'Day 1, stop 1: time must be HH:MM, like 09:30.');
  assert.equal(trMsg('zh_TW', 'Day 1: something new.'), 'Day 1: something new.');
});
