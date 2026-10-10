// Contract for toPinyin in app/js/zhuyin.js. Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSyllable, alignZhuyin, toPinyin } from '../../app/js/zhuyin.js';
import { guidebook } from '../fixtures.js';

const py = z => toPinyin(parseSyllable(z));

const CASES = {
  // initial + simple final, tone placement
  'ㄋㄧˇ': 'nǐ', 'ㄏㄠˇ': 'hǎo', 'ㄊㄤˊ': 'táng', 'ㄘㄜˋ': 'cè', 'ㄋㄟˋ': 'nèi', 'ㄕㄥ': 'shēng',
  'ㄅㄧㄥ': 'bīng', 'ㄑㄧㄥˇ': 'qǐng', 'ㄇㄧㄣˇ': 'mǐn', 'ㄖㄣˊ': 'rén', 'ㄉㄡˋ': 'dòu', 'ㄐㄧㄠˋ': 'jiào',
  // medials with an initial
  'ㄐㄧㄡˋ': 'jiù', 'ㄒㄧㄡ': 'xiū', 'ㄉㄨㄟˋ': 'duì', 'ㄏㄨㄟˋ': 'huì', 'ㄌㄨㄣˋ': 'lùn',
  'ㄓㄨㄥ': 'zhōng', 'ㄏㄨㄥˊ': 'hóng', 'ㄐㄩㄥˇ': 'jiǒng', 'ㄕㄨㄛ': 'shuō', 'ㄍㄨㄛˋ': 'guò',
  'ㄏㄨㄚ': 'huā', 'ㄒㄧㄝˋ': 'xiè', 'ㄐㄧㄝˊ': 'jié', 'ㄉㄨㄛ': 'duō',
  // ü rules
  'ㄑㄩˋ': 'qù', 'ㄒㄩ': 'xū', 'ㄐㄩㄝˊ': 'jué', 'ㄌㄩˋ': 'lǜ', 'ㄋㄩˇ': 'nǚ', 'ㄌㄩㄝˋ': 'lüè',
  // no initial: y / w / yu
  'ㄧˋ': 'yì', 'ㄧ': 'yī', 'ㄧㄠˋ': 'yào', 'ㄧㄢˊ': 'yán', 'ㄧㄡˇ': 'yǒu', 'ㄧㄣ': 'yīn', 'ㄧㄥˊ': 'yíng', 'ㄧㄝˋ': 'yè',
  'ㄨˇ': 'wǔ', 'ㄨㄛˇ': 'wǒ', 'ㄨㄣˊ': 'wén', 'ㄨㄞˋ': 'wài', 'ㄨㄟˋ': 'wèi', 'ㄨㄥ': 'wēng',
  'ㄩˊ': 'yú', 'ㄩㄝˋ': 'yuè', 'ㄩㄢˋ': 'yuàn', 'ㄩㄣˋ': 'yùn', 'ㄩㄥˋ': 'yòng',
  // standalone sibilants, er, bare finals
  'ㄔ': 'chī', 'ㄓˇ': 'zhǐ', 'ㄦˊ': 'ér', 'ㄜˋ': 'è', 'ㄚ': 'ā', 'ㄡ': 'ōu',
  // neutral tone
  '˙ㄒㄧㄝ': 'xie', '˙ㄙ': 'si', '˙ㄗ': 'zi', '˙ㄇㄚ': 'ma', '˙ㄍㄜ': 'ge', '˙ㄌㄜ': 'le',
};

test('toPinyin spelling and tone placement', () => {
  const wrong = Object.entries(CASES).filter(([z, want]) => py(z) !== want).map(([z, want]) => `${z}: got ${py(z)}, want ${want}`);
  assert.deepEqual(wrong, []);
});

test('the guidebook phrases convert to the expected pinyin', () => {
  const sentence = ph => alignZhuyin(ph.zh_TW, ph.zhuyin).filter(a => a.syllable).map(a => toPinyin(a.syllable)).join(' ');
  const byId = Object.fromEntries(guidebook.phrases.map(p => [p.id, p]));
  assert.equal(sentence(byId['hello']), 'nǐ hǎo');
  assert.equal(sentence(byId['thank-you']), 'xiè xie');
  assert.equal(sentence(byId['no-chinese']), 'wǒ bú huì shuō zhōng wén');
  assert.equal(sentence(byId['hospital']), 'wǒ xū yào qù yī yuàn');
  for (const ph of guidebook.phrases) assert.ok(!sentence(ph).includes('ü') || /[nl]ü/.test(sentence(ph)), ph.id);
});
