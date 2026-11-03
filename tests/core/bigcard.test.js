// The show card (bigcard.js): its markup, the 🔊 repeat rate, the screen wake lock; and what each card reads aloud.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAY_RATE, SLOW_RATE, REPEAT_MS, sayRate, bigCardHtml, wakeKeeper } from '../../app/js/bigcard.js';
import { tr } from '../../app/js/lang.js';
import { driverSay } from '../../app/js/views/place.js';
import { phraseSay } from '../../app/js/views/reference.js';
import { foodDriverSay } from '../../app/js/views/food.js';
import { withParty } from '../../app/js/party.js';
import { foodFor } from '../../app/js/data.js';
import { guidebook, chihkan } from '../fixtures.js';

// ---------- sayRate ----------

test('sayRate: a first tap reads at the normal rate, a quick second tap on the same text slowly', () => {
  assert.ok(SLOW_RATE < SAY_RATE);
  assert.equal(SAY_RATE, 0.85, 'the rate speak() always used');
  assert.equal(sayRate(null, '你好', 1000), SAY_RATE);
  assert.equal(sayRate({ text: '你好', at: 1000 }, '你好', 1000 + 1500), SLOW_RATE);
  assert.equal(sayRate({ text: '你好', at: 1000 }, '你好', 1000 + REPEAT_MS), SLOW_RATE, 'the window includes its end');
  assert.ok(REPEAT_MS >= 2000 && REPEAT_MS <= 10000, 'a few seconds');
});

test('sayRate: after the window, or for other text, back to the normal rate', () => {
  assert.equal(sayRate({ text: '你好', at: 1000 }, '你好', 1000 + REPEAT_MS + 1), SAY_RATE);
  assert.equal(sayRate({ text: '你好', at: 1000 }, '謝謝', 1500), SAY_RATE);
  assert.equal(sayRate({ text: '你好', at: 5000 }, '你好', 1000), SAY_RATE, 'a clock that went back is not a repeat');
});

// ---------- bigCardHtml ----------

const parts = out => ({
  say: out.match(/<button class="btn big-say"[^>]*>[\s\S]*?<\/button>/)?.[0] || null,
  flip: out.match(/<button class="btn big-flip"[^>]*>[\s\S]*?<\/button>/)?.[0] || null,
  close: out.match(/<button class="btn close"[^>]*>[\s\S]*?<\/button>/)?.[0] || null,
});

test('bigCardHtml: the caller\'s text in .big-text, the bar\'s buttons outside it', () => {
  const out = bigCardHtml('<div class="big" lang="zh-TW">你好</div>', 'en', { say: '你好', canSpeak: true });
  assert.ok(out.includes('<div class="big-text"><div class="big" lang="zh-TW">你好</div></div>'));
  const text = out.match(/<div class="big-text">[\s\S]*?<\/div><\/div>/)[0];
  assert.doesNotMatch(text, /<button/, 'the rotating part holds no button');
  assert.ok(out.indexOf('class="big-bar"') < out.indexOf('class="big-text"'), 'the bar comes first (it holds Close, focused on open)');
});

test('bigCardHtml: 🔊 reads `say` (escaped), the flip toggle starts unpressed, Close has class close', () => {
  const { say, flip, close } = parts(bigCardHtml('x', 'en', { say: '赤崁樓，臺南市"<b>"', canSpeak: true }));
  assert.ok(say);
  assert.match(say, /type="button" data-action="big-say" data-say="赤崁樓，臺南市&quot;&lt;b&gt;&quot;"/);
  assert.match(say, /<span aria-hidden="true">🔊<\/span> Read aloud<\/button>$/);
  assert.match(flip, /type="button" data-action="big-flip" aria-pressed="false"/);
  assert.ok(flip.endsWith(` ${tr('en', 'bigFlip')}</button>`));
  assert.match(close, /type="button" data-action="close-big">Close<\/button>/);
});

test('bigCardHtml: no 🔊 without text to read or without a device voice; the other controls stay', () => {
  for (const opts of [{ say: '你好', canSpeak: false }, { say: '', canSpeak: true }, undefined]) {
    const p = parts(bigCardHtml('x', 'en', opts));
    assert.equal(p.say, null, JSON.stringify(opts));
    assert.ok(p.flip && p.close);
  }
});

test('bigCardHtml: labels and the closing hint follow the UI language', () => {
  for (const L of ['en', 'zh_TW']) {
    const out = bigCardHtml('x', L, { say: '你好', canSpeak: true });
    const p = parts(out);
    for (const key of ['bigSay', 'bigFlip', 'close']) assert.ok(out.includes(tr(L, key)), `${L} ${key}`);
    assert.ok(p.close.includes(`>${tr(L, 'close')}</button>`));
    assert.ok(out.includes(`<div class="hint big-hint">${tr(L, 'tapClose')}</div>`), L);
  }
  for (const key of ['bigSay', 'bigFlip']) {
    assert.notEqual(tr('en', key), key, `en ${key}`);
    assert.notEqual(tr('zh_TW', key), tr('en', key), `zh_TW ${key}`);
  }
});

// ---------- wakeKeeper ----------

/** A fake navigator.wakeLock: request() resolves with a sentinel the test can release from the "browser" side. */
function fakeWakeLock({ refuse = false, defer = false } = {}) {
  const api = {
    requests: 0,
    /** @type {any[]} */ sentinels: [],
    /** @type {(() => void)[]} */ waiting: [],
    request(type) {
      assert.equal(type, 'screen');
      api.requests++;
      if (refuse) return Promise.reject(new DOMException('not allowed', 'NotAllowedError'));
      const s = {
        released: false,
        listeners: [],
        addEventListener(t, fn) { if (t === 'release') s.listeners.push(fn); },
        async release() { if (!s.released) { s.released = true; s.listeners.forEach(fn => fn()); } },
      };
      api.sentinels.push(s);
      return defer ? new Promise(r => api.waiting.push(() => r(s))) : Promise.resolve(s);
    },
  };
  return api;
}

test('wakeKeeper: hold takes one screen lock, release lets it go', async () => {
  const api = fakeWakeLock();
  const w = wakeKeeper(() => api, () => true);
  await w.hold();
  assert.equal(api.requests, 1);
  assert.equal(w.held(), true);
  await w.hold();
  await w.resume();
  assert.equal(api.requests, 1, 'no second lock while one is held');
  await w.release();
  assert.equal(api.sentinels[0].released, true);
  assert.equal(w.held(), false);
});

test('wakeKeeper: the browser drops the lock when the page hides; resume takes it again while still wanted', async () => {
  const api = fakeWakeLock();
  let visible = true;
  const w = wakeKeeper(() => api, () => visible);
  await w.hold();
  visible = false;
  await api.sentinels[0].release(); // what the browser does on hide
  assert.equal(w.held(), false);
  await w.resume();
  assert.equal(api.requests, 1, 'not while hidden');
  visible = true;
  await w.resume();
  assert.equal(api.requests, 2);
  assert.equal(w.held(), true);

  await w.release();
  await w.resume();
  assert.equal(api.requests, 2, 'closed: visibility changes take nothing');
});

test('wakeKeeper: a lock marked released without an event counts as gone', async () => {
  const api = fakeWakeLock();
  const w = wakeKeeper(() => api, () => true);
  await w.hold();
  api.sentinels[0].released = true; // no 'release' event fired
  await w.resume();
  assert.equal(api.requests, 2);
});

test('wakeKeeper: closed before the request answers, the late lock is released at once', async () => {
  const tick = () => new Promise(r => setImmediate(r));
  const api = fakeWakeLock({ defer: true });
  const w = wakeKeeper(() => api, () => true);
  const p = w.hold();
  await tick();
  await w.release();
  api.waiting.shift()();
  await p;
  assert.equal(api.requests, 1);
  assert.equal(api.sentinels[0].released, true);
  assert.equal(w.held(), false);

  const q = w.hold();
  w.hold(); // a second open while the first request is pending: still one request
  await tick();
  w.resume();
  await tick();
  assert.equal(api.requests, 2);
  api.waiting.shift()();
  await q;
  assert.equal(w.held(), true);
  assert.equal(api.sentinels[1].released, false);
});

test('wakeKeeper: a silent no-op without the API, or when the browser refuses', async () => {
  for (const getApi of [() => undefined, () => null, () => ({}), () => { throw new Error('no navigator'); }]) {
    const w = wakeKeeper(getApi, () => true);
    await w.hold();
    await w.resume();
    await w.release();
    assert.equal(w.held(), false);
  }
  const refusing = fakeWakeLock({ refuse: true });
  const w = wakeKeeper(() => refusing, () => true);
  await w.hold();
  assert.equal(refusing.requests, 1);
  assert.equal(w.held(), false);
  await w.release();

  const throwing = { request() { throw new TypeError('sync failure'); } };
  const t = wakeKeeper(() => throwing, () => true);
  await t.hold();
  assert.equal(t.held(), false);
});

// ---------- what each card reads ----------

test('driverSay: the place\'s Chinese name, then its Chinese address', () => {
  assert.equal(driverSay(chihkan), `${chihkan.name.zh_TW}，${chihkan.location.address_zh}`);
  assert.equal(driverSay({ ...chihkan, location: { ...chihkan.location, address_zh: '' } }), chihkan.name.zh_TW);
});

test('phraseSay: the tts respelling when present (also after the party size changes it), else the Chinese', () => {
  const hello = guidebook.phrases.find(p => p.id === 'hello');
  assert.equal(phraseSay(hello), hello.zh_TW);
  assert.equal(phraseSay({ ...hello, tts: '妳好' }), '妳好');
  const tickets = {
    id: 'two-tickets', category: 'sightseeing', en: 'Two tickets, please', zh_TW: '請給我兩張票', tts: '請給我兩張票',
    zhuyin: 'ㄑㄧㄥˇ ㄍㄟˇ ㄨㄛˇ ㄌㄧㄤˇ ㄓㄤ ㄆㄧㄠˋ', pinyin: 'qǐng gěi wǒ liǎng zhāng piào',
    party: { zh_TW: '兩', zhuyin: 'ㄌㄧㄤˇ', pinyin: 'liǎng', en_one: 'One ticket, please', en_other: '{N} tickets, please' },
  };
  assert.equal(phraseSay(withParty(tickets, 3)), '請給我三張票');
});

test('foodDriverSay: the shop\'s name, then its city', () => {
  const tainan = foodFor(guidebook.food, 'Tainan City');
  const pick = tainan.picks[0];
  assert.equal(foodDriverSay(tainan, pick), `${pick.name}，${tainan.city_zh}`);
});
