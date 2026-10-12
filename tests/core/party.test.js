import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PARTY_KEY, PARTY_MIN, PARTY_MAX, clampParty, numberWord, withParty } from '../../app/js/party.js';
import { alignZhuyin, spokenTones } from '../../app/js/zhuyin.js';
import { buildAskPrompt } from '../../app/js/prompt.js';
import { guidebook, places, sampleLog } from '../fixtures.js';

// The two party phrases as in data/phrases.json, plus the contract's "party" field
// (copied here so the tests don't depend on the data file carrying it yet).
const raw = JSON.parse(readFileSync(new URL('../../data/phrases.json', import.meta.url), 'utf8'));
const rawById = id => raw.find(p => p.id === id);
const tickets = {
  ...rawById('two-tickets'),
  party: { zh_TW: '兩', zhuyin: 'ㄌㄧㄤˇ', pinyin: 'liǎng', en_one: 'One ticket, please', en_other: '{N} tickets, please' },
};
const table = {
  ...rawById('table-for-two'),
  party: { zh_TW: '兩', zhuyin: 'ㄌㄧㄤˇ', pinyin: 'liǎng', en_one: 'A table for one, please', en_other: 'A table for {n}, please' },
};

test('constants and clampParty', () => {
  assert.equal(PARTY_KEY, 'tg.party.v1');
  assert.deepEqual([PARTY_MIN, PARTY_MAX], [1, 10]);
  assert.equal(clampParty(3), 3);
  assert.equal(clampParty(0), 1);
  assert.equal(clampParty(-4), 1);
  assert.equal(clampParty(11), 10);
  assert.equal(clampParty(2.6), 3);
  for (const bad of [null, undefined, '3', NaN, Infinity, {}, []]) assert.equal(clampParty(bad), 2, String(bad));
});

test('numberWord', () => {
  assert.equal(numberWord(1), 'one');
  assert.equal(numberWord(7), 'seven');
  assert.equal(numberWord(10), 'ten');
  assert.equal(numberWord(12), '12');
});

test('withParty: a phrase without party comes back unchanged', () => {
  const ph = rawById('how-much');
  assert.equal(withParty(ph, 5), ph);
});

test('withParty: n = 2 gives the phrase as written', () => {
  for (const ph of [tickets, table]) {
    const p = withParty(ph, 2);
    assert.deepEqual([p.zh_TW, p.zhuyin, p.pinyin, p.en], [ph.zh_TW, ph.zhuyin, ph.pinyin, ph.en], ph.id);
  }
});

test('withParty: tickets for 1, 3 and 10', () => {
  const one = withParty(tickets, 1);
  assert.equal(one.zh_TW, '請給我一張票');
  assert.equal(one.zhuyin, 'ㄑㄧㄥˇ ㄍㄟˇ ㄨㄛˇ ㄧ ㄓㄤ ㄆㄧㄠˋ');
  assert.equal(one.pinyin, 'qǐng gěi wǒ yì zhāng piào'); // 一 before 1st-tone 張: yì
  assert.equal(one.en, 'One ticket, please');
  const three = withParty(tickets, 3);
  assert.deepEqual([three.zh_TW, three.pinyin, three.en], ['請給我三張票', 'qǐng gěi wǒ sān zhāng piào', 'Three tickets, please']);
  const ten = withParty(tickets, 10);
  assert.deepEqual([ten.zh_TW, ten.zhuyin, ten.en], ['請給我十張票', 'ㄑㄧㄥˇ ㄍㄟˇ ㄨㄛˇ ㄕˊ ㄓㄤ ㄆㄧㄠˋ', 'Ten tickets, please']);
  assert.equal(tickets.zh_TW, '請給我兩張票', 'input not mutated');
});

test('withParty: table for 1, 4 and out-of-range sizes', () => {
  const one = withParty(table, 1);
  assert.deepEqual([one.zh_TW, one.zhuyin, one.pinyin, one.en],
    ['一位，謝謝', 'ㄧ ㄨㄟˋ ㄒㄧㄝˋ ˙ㄒㄧㄝ', 'yí wèi, xièxie', 'A table for one, please']); // 一 before 4th-tone 位: yí
  const four = withParty(table, 4);
  assert.deepEqual([four.zh_TW, four.pinyin, four.en], ['四位，謝謝', 'sì wèi, xièxie', 'A table for four, please']);
  assert.equal(withParty(table, 0).en, 'A table for one, please');
  assert.equal(withParty(table, 99).zh_TW, '十位，謝謝');
});

test('withParty: Zhuyin still aligns for 1..10, the number sits on its own character, and pinyin 一 matches the spoken tone', () => {
  const ZH = '一兩三四五六七八九十';
  for (const ph of [tickets, table]) {
    const at = [...ph.zh_TW].indexOf('兩');
    for (let n = 1; n <= 10; n++) {
      const p = withParty(ph, n);
      const aligned = alignZhuyin(p.zh_TW, p.zhuyin);
      assert.ok(aligned, `${ph.id} n=${n}`);
      assert.equal(aligned[at].char, ZH[n - 1], `${ph.id} n=${n}`);
      assert.equal(p.zhuyin.split(' ').length, ph.zhuyin.split(' ').length);
      if (n === 1) {
        const spoken = spokenTones(aligned)[at];
        assert.equal(p.pinyin.includes('yí') ? 2 : p.pinyin.includes('yì') ? 4 : 1, spoken, ph.id);
      }
    }
  }
});

test('every party phrase in the guidebook aligns for 1..10', () => {
  for (const ph of guidebook.phrases.filter(p => p.party)) {
    for (let n = 1; n <= 10; n++) {
      const p = withParty(ph, n);
      assert.ok(alignZhuyin(p.zh_TW, p.zhuyin), `${ph.id} n=${n}`);
      assert.doesNotMatch(p.en, /\{[nN]\}/, `${ph.id} n=${n}`);
    }
  }
});

/** @returns {import('../../app/js/types.js').AskContext} */
function ctx(over = {}) {
  return {
    mode: 'plan', pos: null, radius: 3, area: '', customArea: "Da'an", day: 'tomorrow', question: null,
    includeLog: true, log: sampleLog, places, today: '2026-11-03', ...over,
  };
}

test('buildAskPrompt: party size closes the first paragraph; absent or null changes nothing', () => {
  const base = buildAskPrompt(ctx());
  assert.equal(buildAskPrompt(ctx({ party: null })), base);
  assert.doesNotMatch(base, /traveling alone|We are \d+ people/);

  const first = p => p.split('\n\n')[0];
  assert.equal(first(buildAskPrompt(ctx({ party: 1 }))), `${first(base)} I'm traveling alone.`);
  assert.equal(first(buildAskPrompt(ctx({ party: 4 }))), `${first(base)} We are 4 people.`);
  assert.match(first(buildAskPrompt(ctx({ party: 2 }))), /^I'm a visitor traveling in Taiwan\. Today is 2026-11-03 \(day 2 of my trip\)\. We are 2 people\.$/);
  // Only the first paragraph changes.
  assert.equal(buildAskPrompt(ctx({ party: 4 })).split('\n\n').slice(1).join('\n\n'), base.split('\n\n').slice(1).join('\n\n'));
});
