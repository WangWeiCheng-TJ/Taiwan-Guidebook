// The show card in app/js/main.js, driven in the fake browser (tests/fake-dom.js): 🔊 reads the Chinese and a
// quick second tap reads it slowly, the screen stays awake while it is open, the text turns 180°, and only
// Close or the backdrop close it (a tap on the text does not).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, FakeElement } from '../fake-dom.js';
import { guidebook, chihkan } from '../fixtures.js';

const dom = installDom({ hash: '#/place/chihkan-tower', guidebook });

/** A fake device voice: records what it was asked to read. */
const spoken = [];
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.speechSynthesis = { getVoices: () => [], cancel() {}, speak(u) { spoken.push(u); } };

/** A fake navigator.wakeLock (the Screen Wake Lock API). */
const wakeLock = {
  requests: 0,
  /** @type {any[]} */ sentinels: [],
  async request(type) {
    assert.equal(type, 'screen');
    wakeLock.requests++;
    const s = {
      released: false,
      listeners: [],
      addEventListener(t, fn) { if (t === 'release') s.listeners.push(fn); },
      async release() { if (!s.released) { s.released = true; s.listeners.forEach(fn => fn()); } },
    };
    wakeLock.sentinels.push(s);
    return s;
  },
};
navigator.wakeLock = wakeLock;
dom.document.visibilityState = 'visible';

const { SAY_RATE, SLOW_RATE } = await import('../../app/js/bigcard.js');
const { driverSay } = await import('../../app/js/views/place.js');
const { tr } = await import('../../app/js/lang.js');
const { foodFor } = await import('../../app/js/data.js');
await import('../../app/js/main.js');
await settle();

const click = (dataset, parent = dom.view) => dom.view.listeners.click[0]({ target: dom.control(dataset, {}, parent), preventDefault() {} });
/** A tap inside the big card, on `target`. */
const tapCard = target => dom.bigcard.listeners.click[0]({ target, preventDefault() {} });
const cardButton = dataset => dom.control(dataset, {}, dom.bigcard);
const lastWake = () => wakeLock.sentinels[wakeLock.sentinels.length - 1];
const visibility = async state => {
  dom.document.visibilityState = state;
  dom.document.dispatch('visibilitychange');
  await settle();
};

test('the driver card has 🔊 reading the place\'s name and address, the 180° toggle and Close', async () => {
  click({ action: 'driver', id: 'chihkan-tower' });
  await settle();
  assert.equal(dom.bigcard.hidden, false);
  const html = dom.bigcard.innerHTML;
  assert.ok(html.includes(`data-action="big-say" data-say="${driverSay(chihkan)}"`));
  assert.ok(driverSay(chihkan).includes(chihkan.location.address_zh));
  assert.match(html, /data-action="big-flip" aria-pressed="false"/);
  assert.match(html, /class="btn close" type="button" data-action="close-big"/);
  assert.ok(html.includes(`<div class="big-text"><div class="big" lang="zh-TW">${chihkan.name.zh_TW}</div>`));
  assert.equal(dom.document.activeElement, dom.bigClose, 'focus on Close');
});

test('the screen is kept awake while the card is open', () => {
  assert.equal(wakeLock.requests, 1);
  assert.equal(lastWake().released, false);
});

test('a tap on the text does not close the card', async () => {
  const n = dom.entries();
  tapCard(new FakeElement(dom.document, { tag: 'div', parent: dom.bigcard }));
  tapCard(new FakeElement(dom.document, { tag: 'div', parent: new FakeElement(dom.document, { parent: dom.bigcard }) }));
  await settle();
  assert.equal(dom.bigcard.hidden, false);
  assert.equal(dom.entries(), n);
  assert.equal(dom.location.hash, '#/place/chihkan-tower');
  // so the hint no longer says "tap anywhere"
  assert.ok(dom.bigcard.innerHTML.includes(tr('en', 'tapClose')));
  assert.doesNotMatch(tr('en', 'tapClose'), /anywhere/);
  assert.doesNotMatch(tr('zh_TW', 'tapClose'), /任何地方/);
});

test('🔊 reads the Chinese; a second tap soon after reads it again more slowly; the card stays open', async () => {
  const say = driverSay(chihkan);
  tapCard(cardButton({ action: 'big-say', say }));
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, say);
  assert.equal(spoken[0].lang, 'zh-TW');
  assert.equal(spoken[0].rate, SAY_RATE);
  tapCard(cardButton({ action: 'big-say', say }));
  assert.equal(spoken[1].rate, SLOW_RATE);
  spoken[1].onend?.(); // the slow reading ends: a tap right after is still "again"
  tapCard(cardButton({ action: 'big-say', say }));
  assert.equal(spoken[2].rate, SLOW_RATE);
  await settle();
  assert.equal(dom.bigcard.hidden, false);
});

test('the 180° toggle turns the text and says so with aria-pressed; the card stays open', async () => {
  const btn = cardButton({ action: 'big-flip' });
  tapCard(btn);
  assert.ok(dom.bigcard.classList.contains('flipped'));
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  tapCard(btn);
  assert.equal(dom.bigcard.classList.contains('flipped'), false);
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  tapCard(btn);
  await settle();
  assert.equal(dom.bigcard.hidden, false);
});

test('back from another app: the wake lock the browser dropped is taken again while the card is open', async () => {
  await visibility('hidden');
  await lastWake().release(); // the browser releases it on hide
  assert.equal(wakeLock.requests, 1, 'not while hidden');
  await visibility('visible');
  assert.equal(wakeLock.requests, 2);
  assert.equal(lastWake().released, false);
  await visibility('visible');
  assert.equal(wakeLock.requests, 2, 'still held: no second lock');
});

test('Close closes the card (Back entry), releases the wake lock, and visibility changes then take nothing', async () => {
  tapCard(dom.bigClose);
  await settle();
  assert.equal(dom.bigcard.hidden, true);
  assert.equal(dom.location.hash, '#/place/chihkan-tower');
  assert.equal(lastWake().released, true);
  await visibility('hidden');
  await visibility('visible');
  assert.equal(wakeLock.requests, 2);
});

test('a card opens upright and its first 🔊 tap reads at the normal rate, even right after another card', async () => {
  click({ action: 'driver', id: 'chihkan-tower' });
  tapCard(cardButton({ action: 'big-flip' }));
  tapCard(cardButton({ action: 'big-say', say: driverSay(chihkan) }));
  tapCard(dom.bigcard); // the backdrop
  await settle();
  assert.equal(dom.bigcard.hidden, true, 'a tap on the backdrop closes it');

  click({ action: 'driver', id: 'chihkan-tower' });
  assert.equal(dom.bigcard.classList.contains('flipped'), false);
  const n = spoken.length;
  tapCard(cardButton({ action: 'big-say', say: driverSay(chihkan) }));
  assert.equal(spoken[n].rate, SAY_RATE);
  tapCard(dom.bigcard);
  await settle();
  assert.equal(dom.bigcard.hidden, true);
});

test('the phrase card\'s 🔊 reads the phrase', async () => {
  click({ action: 'phrase-sheet', id: 'hello' });
  dom.sheet.listeners.click[0]({ target: dom.control({ action: 'show-phrase', id: 'hello' }, {}, dom.sheet), preventDefault() {} });
  assert.equal(dom.bigcard.hidden, false);
  const hello = guidebook.phrases.find(p => p.id === 'hello');
  assert.ok(dom.bigcard.innerHTML.includes(`data-action="big-say" data-say="${hello.tts || hello.zh_TW}"`));
  tapCard(dom.bigClose);
  await settle();
  assert.equal(dom.bigcard.hidden, true);
  assert.equal(dom.sheet.hidden, false, 'Close closes the card only, not the sheet under it');
  dom.sheet.listeners.click[0]({ target: dom.sheetClose, preventDefault() {} });
  await settle();
});

test('a food pick\'s driver card reads the shop\'s name and city', async () => {
  const tainan = foodFor(guidebook.food, 'Tainan City');
  const pick = tainan.picks[0];
  click({ action: 'food-driver', city: 'Tainan City', id: pick.id });
  assert.ok(dom.bigcard.innerHTML.includes(`data-say="${pick.name}，${tainan.city_zh}"`));
  tapCard(dom.bigcard);
  await settle();
  assert.equal(dom.bigcard.hidden, true);
});

test('without a device voice there is no 🔊; the card still opens with its other controls in the UI language', async () => {
  const saved = globalThis.speechSynthesis;
  delete globalThis.speechSynthesis;
  try {
    click({ action: 'driver', id: 'chihkan-tower' });
    assert.doesNotMatch(dom.bigcard.innerHTML, /big-say/);
    assert.ok(dom.bigcard.innerHTML.includes(tr('en', 'bigFlip')));
    tapCard(dom.bigClose);
    await settle();
  } finally {
    globalThis.speechSynthesis = saved;
  }
});
