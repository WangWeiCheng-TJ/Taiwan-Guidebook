// "Taiwan through the places" page (#/learn/timeline, views/learn.js), its links from the Learn page and the place
// page, and its Copy for AI text (prompt.js buildTimelinePrompt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state as appState } from '../../app/js/state.js';
import { renderLearn, renderTimeline, timelinePrompt } from '../../app/js/views/learn.js';
import { renderPlace } from '../../app/js/views/place.js';
import { mergeTimeline, eraLabel } from '../../app/js/timeline.js';
import { buildTimelinePrompt } from '../../app/js/prompt.js';
import { esc } from '../../app/js/util.js';
import { guidebook, chihkan } from '../fixtures.js';

const schema = JSON.parse(readFileSync(new URL('../../schema/attraction.schema.json', import.meta.url), 'utf8'));
const [, DUTCH, , QING, JAPANESE, MODERN] = schema.properties.eras.items.enum;

const place = (id, eras, timeline, generated_by = 'Curatorial Team') => ({
  id, eras, timeline, metadata: { generated_by },
  name: { en: `Place ${id}`, zh_TW: `景點${id}` },
  location: { city_en: 'Tainan City', city_zh: '臺南市', district_en: 'West Central', district_zh: '中西區' },
});
const ev = (year_or_era, era_category, n) => ({ year_or_era, era_category, event_en: `Event ${n}.`, event_zh: `事件${n}。` });
const A = place('a', [QING, MODERN], [ev('1890', 'Qing Dynasty', 1), ev('Present', 'Modern Era', 2)]);
const B = place('b', [DUTCH, JAPANESE], [ev('1628', 'Spanish Colonial', 3), ev('1926', 'Japanese Colonial', 4)],
  'agy draft; pending owner review');
const s = (lang, places = [A, B], extra = {}) => ({ lang, data: { places, ...extra } });
const hrefs = (html, re) => [...html.matchAll(re)].map(m => m[1]);

test('Learn page: a card to the timeline, before the topics; none when no place has a timeline', () => {
  const topics = [{ id: 'kuixing', title: { en: 'Kuixing', zh_TW: '魁星' }, summary: { en: 'S.', zh_TW: '摘。' } }];
  const html = renderLearn(s('en', [A, B], { topics }));
  assert.deepEqual(hrefs(html, /href="#\/learn\/([^"]+)"/g), ['timeline', 'kuixing']);
  assert.match(html, /<a class="card" href="#\/learn\/timeline">\s*<div class="title">Taiwan through the places<\/div>/);
  assert.ok(renderLearn(s('zh_TW')).includes('<div class="title">從景點看台灣</div>'));
  assert.ok(!renderLearn(s('en', [place('q', [QING], [])])).includes('#/learn/timeline'));
  assert.ok(!renderLearn(s('en', [])).includes('#/learn/timeline'));
});

test('#/learn/timeline: back to Learn, the title, Copy for AI, eras in order, each event linked to its place', () => {
  const html = renderLearn(s('en'), 'timeline');
  assert.equal(html, renderTimeline(s('en')));
  assert.match(html, /<a href="#\/learn" class="small">‹ Learn about Taiwan<\/a>/);
  assert.match(html, /<h1>Taiwan through the places<\/h1>/);
  assert.match(html, /<button class="btn" data-action="copy-timeline">Copy for AI<\/button>/);
  assert.deepEqual(hrefs(html, /<h2>([^<]+)<\/h2>/g), [DUTCH, QING, JAPANESE, MODERN].map(esc), 'as in the data, escaped');
  assert.deepEqual(hrefs(html, /<b>([^<]+)<\/b>/g), ['1628', '1890', '1926', 'Present']);
  assert.deepEqual(hrefs(html, /href="#\/place\/([^"]+)"/g), ['b', 'a', 'b', 'a'], 'every event links to its place');
  assert.ok(html.includes('<b>1890</b>Event 1.'));
  assert.ok(html.includes('><span>Place a<span class="muted">&nbsp;· Tainan City</span></span></a>'), 'named, with its city, as one flex item (a long name wraps with its city)');
});

test('#/learn/timeline: a place pending owner review gets the Learn page\'s draft note on each of its events', () => {
  const html = renderTimeline(s('en'));
  const items = html.split('<li>').slice(1);
  const note = '<span class="muted small pending">Draft: the guide’s author has not checked this yet.</span>';
  assert.deepEqual(items.map(li => li.includes(note)), [true, false, true, false]); // b, a, b, a
  assert.ok(renderTimeline(s('zh_TW')).includes('草稿：手冊作者還沒有審閱這篇。'));
});

test('#/learn/timeline in Chinese: Chinese eras and events; English left in the page is marked English', () => {
  const html = renderTimeline(s('zh_TW'));
  assert.match(html, /<h1>從景點看台灣<\/h1>/);
  assert.match(html, /data-action="copy-timeline">複製給 AI</);
  assert.deepEqual(hrefs(html, /<h2>([^<]+)<\/h2>/g), [DUTCH, QING, JAPANESE, MODERN].map(e => eraLabel(e, 'zh_TW')));
  assert.ok(html.includes('<b>1890</b>事件1。'));
  assert.ok(html.includes('<b lang="en">Present</b>事件2。'), '"Present" is English');
  assert.ok(html.includes('><span>景點a<span class="muted">&nbsp;· 臺南市</span></span></a>'));
  const odd = renderTimeline(s('zh_TW', [place('o', ['Late Ming (1644–1683)'], [ev('1650', '', 9)])]));
  assert.ok(odd.includes('<h2 lang="en">Late Ming (1644–1683)</h2>'), 'an era with no Chinese heading');
  assert.ok(!renderTimeline(s('en')).includes('lang="en"'), 'nothing to mark in the English UI');
});

test('#/learn/timeline: events that fit no era come last under "Other times"', () => {
  const html = renderTimeline(s('en', [place('x', [QING], [ev('Someday', 'Unknown', 5), ev('1700', 'Qing', 6)])]));
  assert.deepEqual(hrefs(html, /<h2>([^<]+)<\/h2>/g), [QING, 'Other times']);
});

test('#/learn/timeline without events: says so, no Copy for AI', () => {
  const html = renderTimeline(s('en', []));
  assert.match(html, /No timeline events yet\./);
  assert.ok(!html.includes('copy-timeline') && !html.includes('<h2'));
  assert.match(renderTimeline({ lang: 'zh_TW', data: null }), /目前還沒有年表。/);
});

test('#/learn/timeline escapes the data', () => {
  const bad = place('x"y', [QING], [{ year_or_era: '<i>1700</i>', era_category: 'Qing', event_en: '<img src=x onerror=alert(1)>', event_zh: '' }]);
  bad.name.en = '<script>x</script>';
  const html = renderTimeline(s('en', [bad]));
  assert.ok(html.includes('href="#/place/x&quot;y"'));
  assert.ok(html.includes('&lt;img src=x') && html.includes('&lt;script&gt;') && html.includes('&lt;i&gt;1700'));
  assert.ok(!/<img|<script|<i>/.test(html));
});

test('the bundled guide: every event on the page, each linking to a known place, in both languages', () => {
  const known = new Set(guidebook.places.map(p => p.id));
  const total = guidebook.places.reduce((n, p) => n + p.timeline.length, 0);
  for (const L of ['en', 'zh_TW']) {
    const links = hrefs(renderTimeline({ lang: L, data: guidebook }), /<a class="row-link small" href="#\/place\/([^"]+)"/g);
    assert.equal(links.length, total, L);
    assert.ok(links.every(id => known.has(id)), L);
  }
});

test('place page: the timeline section links to the timeline of all places', () => {
  appState.data = guidebook;
  try {
    for (const [L, text] of [['en', 'All places on one timeline ›'], ['zh_TW', '所有景點的年表 ›']]) {
      appState.lang = L;
      const html = renderPlace(appState, chihkan.id);
      const link = html.indexOf(`<a class="row-link small" href="#/learn/timeline">${text}</a>`);
      assert.ok(link > html.indexOf('<ul class="timeline">'), L);
      assert.ok(link < html.indexOf('</details>', html.indexOf('<ul class="timeline">')), `${L}: inside the timeline section`);
    }
  } finally {
    appState.data = null;
    appState.lang = 'en';
  }
});

test('buildTimelinePrompt: era by era, each event with its place in both languages, then the story request', () => {
  const text = buildTimelinePrompt(mergeTimeline([A, B]), 'en');
  assert.match(text, /^Here is a timeline of Taiwan's history made from the places in my travel guidebook/);
  const order = [DUTCH, '- 1628 · Place b (景點b): Event 3. [draft]', QING, '- 1890 · Place a (景點a): Event 1.',
    JAPANESE, '- 1926 · Place b (景點b): Event 4. [draft]', MODERN, '- Present · Place a (景點a): Event 2.'];
  let at = -1;
  for (const line of order) {
    const i = text.indexOf(line);
    assert.ok(i > at, `${line} in order`);
    at = i;
  }
  assert.ok(text.includes(`\n\n${QING}\n- 1890 · Place a (景點a): Event 1.\n\n`), 'a heading, then its events');
  assert.match(text, /Events marked \[draft\] come from entries the guidebook's author has not checked yet/);
  assert.match(text, /Tell me the story that connects these places/);
  assert.ok(!text.includes('Traditional Chinese'));
  assert.ok(!text.includes('事件'), 'English data');
});

test('buildTimelinePrompt: no draft line without drafts; the Chinese UI asks for a Chinese reply', () => {
  const text = buildTimelinePrompt(mergeTimeline([A]), 'zh_TW');
  assert.ok(!text.includes('[draft]'));
  assert.match(text, /Tell me the story that connects these places[^\n]*\n\nPlease reply in Traditional Chinese \(Taiwan\)\.$/);
  assert.match(buildTimelinePrompt(mergeTimeline([place('x', [QING], [ev('Someday', '', 7)])])), /^Era not given\n- Someday · Place x/m);
});

test('timelinePrompt: the text for the page\'s Copy for AI, in the UI language', () => {
  assert.equal(timelinePrompt(s('zh_TW')), buildTimelinePrompt(mergeTimeline([A, B]), 'zh_TW'));
  assert.equal(timelinePrompt({ lang: 'en', data: guidebook }), buildTimelinePrompt(mergeTimeline(guidebook.places), 'en'));
});
