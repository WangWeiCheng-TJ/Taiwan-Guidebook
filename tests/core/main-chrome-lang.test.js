// The parts of the page outside #view follow the UI language (app/js/main.js in the fake browser,
// tests/fake-dom.js): the tab bar's landmark name and the page title too, not only the visible labels
// (review: in 中文 a screen reader still said "Sections" and the tab title stayed English).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

const dom = installDom({ hash: '#/explore', guidebook, language: 'zh-TW' });
const { tr } = await import('../../app/js/lang.js');
await import('../../app/js/main.js');
await settle();

const tabbar = dom.document.querySelector('.tabbar');

test('a Chinese browser: the title and the tab bar\'s name are Chinese', () => {
  assert.equal(dom.document.title, '台灣旅遊手冊');
  assert.equal(tabbar.getAttribute('aria-label'), tr('zh_TW', 'navLabel'));
  assert.notEqual(tr('zh_TW', 'navLabel'), tr('en', 'navLabel'));
});

test('the language switch changes them with the rest', async () => {
  dom.document.getElementById('lang-toggle').listeners.click[0]();
  await settle();
  assert.equal(dom.document.title, 'Taiwan Guidebook');
  assert.equal(tabbar.getAttribute('aria-label'), 'Sections');
  dom.document.getElementById('lang-toggle').listeners.click[0]();
  await settle();
  assert.equal(dom.document.title, tr('zh_TW', 'brand'));
});
