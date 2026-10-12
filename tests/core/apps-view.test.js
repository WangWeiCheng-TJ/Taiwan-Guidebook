// Recommended apps page (#/apps) and the Tips tab tiles that lead to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_CATEGORIES, renderApps, isHttps } from '../../app/js/views/apps.js';
import { renderTips } from '../../app/js/views/reference.js';
import { guidebook } from '../fixtures.js';

const app = (id, category, extra = {}) => ({
  id, category,
  name: { en: `App ${id}`, zh_TW: `應用${id}` },
  why: { en: `Why ${id}.`, zh_TW: `原因${id}。` },
  url: `https://example.com/${id}`,
  platforms: ['ios', 'android'],
  ...extra,
});
const state = (lang, data) => ({ lang, data: { places: [], phrases: [], tips: [], food: [], ...data } });
const headings = html => [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1]);

test('APP_CATEGORIES is the contract list, in display order', () => {
  assert.deepEqual(APP_CATEGORIES, ['getting-around', 'taxi', 'trains', 'messaging', 'language', 'weather', 'food']);
});

test('lang.js has apps.cat.<category> in both en and zh_TW, and no others', () => {
  const src = readFileSync(new URL('../../app/js/lang.js', import.meta.url), 'utf8');
  const [en, zh] = src.split('en: {')[1].split('zh_TW: {');
  for (const table of [en, zh]) {
    const keys = [...table.matchAll(/'apps\.cat\.([\w-]+)':/g)].map(m => m[1]);
    assert.deepEqual([...keys].sort(), [...APP_CATEGORIES].sort());
  }
});

test('apps are grouped in APP_CATEGORIES order, data order within a group', () => {
  const apps = [app('f', 'food'), app('t1', 'taxi'), app('g', 'getting-around'), app('t2', 'taxi')];
  const html = renderApps(state('en', { apps }));
  assert.deepEqual(headings(html), ['Getting around', 'Taxis', 'Food']);
  const order = [...html.matchAll(/App (\w+)/g)].map(m => m[1]);
  assert.deepEqual(order, ['g', 't1', 't2', 'f']);
  assert.match(html, /<h1>Recommended apps<\/h1>/);
  assert.match(html, /href="#\/tips"/);
  assert.deepEqual(headings(renderApps(state('zh_TW', { apps }))), ['交通導航', '計程車', '美食']);
});

test('a card: name in the UI language, the other small, why, platforms, link to the official page', () => {
  const html = renderApps(state('en', { apps: [app('a', 'trains')] }));
  assert.ok(html.includes('App a <span class="muted small" lang="zh-TW">應用a</span>'));
  assert.ok(html.includes('<p>Why a.</p>'));
  assert.ok(html.includes('iOS · Android'));
  assert.match(html, /<a class="btn small" href="https:\/\/example\.com\/a" target="_blank" rel="noopener">Official page ›<\/a>/);
  const zh = renderApps(state('zh_TW', { apps: [app('a', 'trains')] }));
  assert.ok(zh.includes('應用a <span class="muted small" lang="en">App a</span>'));
  assert.ok(zh.includes('<p>原因a。</p>') && zh.includes('官方網頁 ›'));
});

test('the same name in both languages is shown once; a missing translation falls back to English', () => {
  const html = renderApps(state('zh_TW', { apps: [app('line', 'messaging', { name: { en: 'LINE', zh_TW: 'LINE' }, why: { en: 'Only English.' } })] }));
  assert.equal(html.match(/LINE/g).length, 1);
  assert.ok(html.includes('<p>Only English.</p>'));
});

test('apps escape data and link only https URLs', () => {
  const apps = [
    app('x', 'food', { name: { en: '<img src=x onerror=alert(1)>', zh_TW: '"引號"' }, why: { en: 'a & b <b>' }, platforms: ['ios', '<web>'] }),
    app('y', 'food', { url: 'javascript:alert(1)' }),
    app('z', 'food', { url: 'https://example.com/"onclick="x' }),
  ];
  const html = renderApps(state('en', { apps }));
  assert.ok(!html.includes('<img') && html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&quot;引號&quot;') && html.includes('a &amp; b &lt;b&gt;') && html.includes('&lt;web&gt;'));
  assert.equal(html.match(/<a class="btn small"/g).length, 1, 'only the https URL becomes a link');
  assert.ok(!html.includes('javascript:'));
  assert.ok(isHttps('https://apps.apple.com/tw/app/x/id1') && !isHttps('http://example.com') && !isHttps(undefined));
});

test('a bundle without apps shows a note instead of failing', () => {
  assert.match(renderApps(state('en', {})), /No apps listed yet\./);
  assert.match(renderApps({ lang: 'zh_TW', data: { apps: [] } }), /還沒有推薦的 App。/);
});

test('Tips tab: tiles to #/apps and #/learn come before the tips', () => {
  const tips = [{ id: 't', scope: 'global', category: 'safety', title_en: 'T', title_zh: 'T', body_en: 'B', body_zh: 'B' }];
  const html = renderTips(state('en', { tips, apps: [app('a', 'taxi'), app('b', 'food')], topics: [{ id: 'k' }] }));
  const tiles = html.indexOf('<div class="tiles">');
  assert.ok(tiles > 0 && tiles < html.indexOf('<h2>'));
  assert.match(html, /<a class="tile" href="#\/apps">[\s\S]*Recommended apps[\s\S]*<span class="tile-count">2<\/span>/);
  assert.match(html, /<a class="tile" href="#\/learn">[\s\S]*Learn about Taiwan[\s\S]*<span class="tile-count">1<\/span>/);
  const old = renderTips(state('zh_TW', { tips }));
  assert.ok(old.includes('推薦 App') && old.includes('認識台灣') && !old.includes('tile-count'));
});

test('build_dataset.py APP_CATEGORIES matches the UI list', { skip: !/^APP_CATEGORIES\s*=/m.test(readFileSync(new URL('../../scripts/build_dataset.py', import.meta.url), 'utf8')) && 'build has no APP_CATEGORIES yet' }, () => {
  const src = readFileSync(new URL('../../scripts/build_dataset.py', import.meta.url), 'utf8');
  const body = src.match(/^APP_CATEGORIES\s*=\s*[[{(]([^\]})]*)/m)[1];
  assert.deepEqual([...body.matchAll(/["']([\w-]+)["']/g)].map(m => m[1]).sort(), [...APP_CATEGORIES].sort());
});

test('every app in the bundle (when present) has a known category and an https link', { skip: !guidebook.apps?.length && 'no apps in the bundle yet' }, () => {
  for (const a of guidebook.apps) {
    assert.ok(APP_CATEGORIES.includes(a.category), `${a.id}: ${a.category}`);
    assert.ok(isHttps(a.url), `${a.id}: ${a.url}`);
  }
});
