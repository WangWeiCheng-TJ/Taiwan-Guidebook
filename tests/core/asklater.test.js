// app/js/asklater.js: the Ask later list (every copied prompt, kept on the device). Pure helpers only; the wiring
// in main.js is tested in main-asklater.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ASK_LATER_KEY, ASK_LATER_MAX, ASK_LATER_KINDS, laterItem, addLater, removeLater, markCopied, waitingCount,
  readLater, laterLabel, laterTime } from '../../app/js/asklater.js';

const at = new Date(2026, 10, 10, 14, 5); // local time: 10 Nov 2026, 14:05

/** An item with a distinct prompt per id. */
const item = (id, extra = {}) => laterItem({ id, at, kind: 'explain', subject: id, where: '', prompt: `prompt ${id}`, ...extra });

test('the storage key and the cap', () => {
  assert.equal(ASK_LATER_KEY, 'tg.asklater.v1');
  assert.equal(ASK_LATER_MAX, 10);
  assert.deepEqual([...ASK_LATER_KINDS], ['near', 'plan', 'photo', 'menu', 'place', 'explain']);
});

test('laterItem: ISO time, one-line clipped subject and where, waiting only when copied offline', () => {
  const it = laterItem({ id: 'x', at, kind: 'explain', subject: '  魁星\n  ', where: 'Chihkan Tower', prompt: 'P' });
  assert.deepEqual(it, { id: 'x', at: at.toISOString(), kind: 'explain', subject: '魁星', where: 'Chihkan Tower', prompt: 'P', waiting: false });
  assert.equal(laterItem({ id: 'y', at, kind: 'near', subject: 'Q', prompt: 'P', offline: true }).waiting, true);
  assert.equal(laterItem({ id: 'y', at, kind: 'near', prompt: 'P' }).subject, '', 'no subject: ""');
  const long = laterItem({ id: 'z', at, kind: 'near', subject: 'x'.repeat(100), where: 'y'.repeat(100), prompt: 'P' });
  assert.equal(long.subject.length, 40);
  assert.ok(long.subject.endsWith('…'));
  assert.equal(long.where.length, 40);
});

test('addLater: newest first', () => {
  const list = addLater(addLater([], item('a')), item('b'));
  assert.deepEqual(list.map(x => x.id), ['b', 'a']);
});

test('addLater: at most 10, the oldest dropped', () => {
  let list = [];
  for (let i = 0; i < 12; i++) list = addLater(list, item(`i${i}`));
  assert.equal(list.length, 10);
  assert.equal(list[0].id, 'i11');
  assert.equal(list[9].id, 'i2');
  assert.equal(addLater(list, item('new'), 3).length, 3, 'a smaller cap');
});

test('addLater: the same prompt again moves to the top once, with the new time and waiting flag', () => {
  const offline = item('a', { offline: true });
  let list = addLater(addLater([], offline), item('b'));
  const again = laterItem({ id: 'a2', at: new Date(2026, 10, 10, 15, 0), kind: 'explain', subject: 'a', prompt: 'prompt a' });
  list = addLater(list, again);
  assert.deepEqual(list.map(x => x.id), ['a2', 'b']);
  assert.equal(list[0].waiting, false, 'copied again online: no longer waiting');
});

test('addLater does not change the list it was given', () => {
  const list = [item('a')];
  addLater(list, item('b'));
  assert.deepEqual(list.map(x => x.id), ['a']);
});

test('removeLater: drops the item; an unknown id returns the same array', () => {
  const list = [item('b'), item('a')];
  assert.deepEqual(removeLater(list, 'b').map(x => x.id), ['a']);
  assert.equal(removeLater(list, 'nope'), list);
  assert.deepEqual(removeLater([item('a')], 'a'), []);
});

test('markCopied: the item stops waiting, order kept; nothing to change returns the same array', () => {
  const list = [item('b', { offline: true }), item('a', { offline: true })];
  const out = markCopied(list, 'a');
  assert.deepEqual(out.map(x => [x.id, x.waiting]), [['b', true], ['a', false]]);
  assert.equal(list[1].waiting, true, 'the given list is unchanged');
  assert.equal(markCopied(out, 'a'), out, 'already not waiting');
  assert.equal(markCopied(out, 'nope'), out);
});

test('waitingCount counts items copied offline', () => {
  assert.equal(waitingCount([]), 0);
  assert.equal(waitingCount([item('a', { offline: true }), item('b'), item('c', { offline: true })]), 2);
});

test('readLater: keeps valid items, drops damaged ones, repairs subject and where', () => {
  const good = item('a', { offline: true });
  const raw = [
    good,
    null, 'x', [],
    { ...item('b'), id: '' },
    { ...item('c'), at: 'yesterday' },
    { ...item('d'), kind: 'chat' },
    { ...item('e'), prompt: '   ' },
    { ...item('f'), prompt: 42 },
    { ...item('g'), subject: 7, where: null, waiting: 'yes' },
    { ...item('h'), subject: 'line\nbreak', where: 'z'.repeat(60) },
  ];
  const out = readLater(raw);
  assert.deepEqual(out.map(x => x.id), ['a', 'g', 'h']);
  assert.deepEqual(out[0], good);
  assert.deepEqual([out[1].subject, out[1].where, out[1].waiting], ['', '', false]);
  assert.equal(out[2].subject, 'line break');
  assert.equal(out[2].where.length, 40);
});

test('readLater: not a list is empty; a prompt listed twice is kept once; at most 10', () => {
  assert.deepEqual(readLater(null), []);
  assert.deepEqual(readLater({ a: 1 }), []);
  assert.deepEqual(readLater([item('a'), { ...item('b'), prompt: 'prompt a' }]).map(x => x.id), ['a']);
  const many = Array.from({ length: 15 }, (_, i) => item(`i${i}`));
  assert.equal(readLater(many).length, 10);
  assert.equal(readLater(many)[0].id, 'i0');
});

test('laterLabel: "About 魁星 · Chihkan Tower" and its Chinese', () => {
  const it = laterItem({ id: 'x', at, kind: 'explain', subject: '魁星', where: 'Chihkan Tower', prompt: 'P' });
  assert.equal(laterLabel(it, 'en'), 'About 魁星 · Chihkan Tower');
  assert.equal(laterLabel(it, 'zh_TW'), '關於「魁星」 · Chihkan Tower');
});

test('laterLabel: every kind has a head in both languages; no place, no " · "', () => {
  for (const kind of ASK_LATER_KINDS) {
    const it = laterItem({ id: 'x', at, kind, subject: 'S', prompt: 'P' });
    for (const lang of /** @type {const} */ (['en', 'zh_TW'])) {
      const label = laterLabel(it, lang);
      assert.ok(label.includes('S'), `${kind} ${lang}: ${label}`);
      assert.ok(!label.includes('later.'), `${kind} ${lang}: a string is missing`);
      assert.ok(!label.includes(' · '), `${kind} ${lang}`);
    }
  }
  assert.equal(laterLabel(laterItem({ id: 'x', at, kind: 'plan', subject: "Da'an", prompt: 'P' }), 'en'), "Plan: Da'an");
  assert.equal(laterLabel(laterItem({ id: 'x', at, kind: 'place', subject: '赤崁樓', where: '臺南市', prompt: 'P' }), 'zh_TW'), '關於赤崁樓 · 臺南市');
});

test('laterLabel: a photo preset is named in the UI language; an empty subject shows "…"', () => {
  const photo = laterItem({ id: 'x', at, kind: 'photo', subject: 'menu', where: 'Tainan City', prompt: 'P' });
  assert.equal(laterLabel(photo, 'en'), 'Photo: Menu · Tainan City');
  assert.equal(laterLabel(photo, 'zh_TW'), '照片：菜單 · Tainan City');
  assert.equal(laterLabel({ ...photo, subject: 'Something else' }, 'en'), 'Photo: Something else · Tainan City');
  assert.equal(laterLabel(laterItem({ id: 'x', at, kind: 'near', prompt: 'P' }), 'en'), 'Near me: …');
});

test('laterTime: the time on the same local day, else month/day and time', () => {
  const it = item('a');
  assert.equal(laterTime(it, new Date(2026, 10, 10, 23, 59)), '14:05');
  assert.equal(laterTime(it, new Date(2026, 10, 11, 0, 1)), '11/10 14:05');
  assert.equal(laterTime(laterItem({ id: 'b', at: new Date(2026, 0, 3, 9, 7), kind: 'near', prompt: 'P' }), at), '1/3 09:07');
});
