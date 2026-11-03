// A phrase's `party` field must really change the Chinese the clerk reads, not only the English.
// partyProblems() is the check; the build (scripts/build_dataset.py party_problems) enforces the same on data/phrases.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withParty, PARTY_MIN, PARTY_MAX } from '../../app/js/party.js';
import { guidebook } from '../fixtures.js';

const ZH = '一兩三四五六七八九十';

/**
 * For every size other than 2 the zh_TW, zhuyin and pinyin must differ from the size-2 form, and zh_TW
 * must carry that size's number.
 * @param {import('../../app/js/types.js').Phrase} phrase
 * @returns {string[]}
 */
function partyProblems(phrase) {
  const two = withParty(phrase, 2);
  const out = [];
  for (let n = PARTY_MIN; n <= PARTY_MAX; n++) {
    if (n === 2) continue;
    const p = withParty(phrase, n);
    for (const key of ['zh_TW', 'zhuyin', 'pinyin']) if (p[key] === two[key]) out.push(`n=${n}: ${key} does not change`);
    if (!p.zh_TW.includes(ZH[n - 1])) out.push(`n=${n}: zh_TW has no ${ZH[n - 1]}`);
  }
  return out;
}

const tickets = {
  id: 'two-tickets', category: 'sightseeing', en: 'Two tickets, please', zh_TW: '請給我兩張票',
  zhuyin: 'ㄑㄧㄥˇ ㄍㄟˇ ㄨㄛˇ ㄌㄧㄤˇ ㄓㄤ ㄆㄧㄠˋ', pinyin: 'qǐng gěi wǒ liǎng zhāng piào',
  party: { zh_TW: '兩', zhuyin: 'ㄌㄧㄤˇ', pinyin: 'liǎng', en_one: 'One ticket, please', en_other: '{N} tickets, please' },
};

test('partyProblems: a well-formed party field has none', () => {
  assert.deepEqual(partyProblems(tickets), []);
});

test('partyProblems: a party field that does not occur in the phrase is caught', () => {
  // The English still follows the size, the Chinese stays 請給我兩張票.
  const wrongChar = { ...tickets, party: { ...tickets.party, zh_TW: '二' } };
  assert.equal(withParty(wrongChar, 3).en, 'Three tickets, please');
  assert.equal(withParty(wrongChar, 3).zh_TW, '請給我兩張票');
  assert.ok(partyProblems(wrongChar).length > 0);
  assert.ok(partyProblems({ ...tickets, party: { ...tickets.party, zhuyin: 'ㄌㄧㄤ' } }).length > 0);
  assert.ok(partyProblems({ ...tickets, party: { ...tickets.party, pinyin: 'èr' } }).length > 0);
});

test('every party phrase in the bundle changes its Chinese with the size', () => {
  for (const ph of guidebook.phrases.filter(p => p.party)) assert.deepEqual(partyProblems(ph), [], ph.id);
});

// The two bundle checks above (and "every party phrase in the guidebook aligns" in party.test.js) loop over
// phrases with a `party` field. data/phrases.json has none yet (BACKLOG: Party size), so they run no
// assertion. This case says so in every test run instead of passing as coverage; once two-tickets and
// table-for-two get their party field it passes, and the todo can go.
test('the bundle has party phrases, so the bundle party checks run', {
  todo: 'no phrase in data/phrases.json has a party field yet (BACKLOG: Party size)',
}, () => {
  assert.ok(guidebook.phrases.some(p => p.party), 'no phrase carries party');
});
