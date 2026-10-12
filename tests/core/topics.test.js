// Knowledge topics: topic <-> place links (topics.js) and the Learn pages (views/learn.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { topicById, topicsForPlace, placesForTopic } from '../../app/js/topics.js';
import { renderLearn, isPending } from '../../app/js/views/learn.js';
import { guidebook } from '../fixtures.js';

const place = (id, tags) => ({
  id, tags,
  name: { en: `Place ${id}`, zh_TW: `景點${id}` },
  location: { city_en: 'Tainan City', city_zh: '臺南市', district_en: 'West Central', district_zh: '中西區', coordinates: { lat: 23, lng: 120.2 } },
});
const topic = (id, places, tags, extra = {}) => ({
  id, places, tags,
  title: { en: `Title ${id}`, zh_TW: `標題${id}` },
  summary: { en: `Summary ${id}.`, zh_TW: `摘要${id}。` },
  body: { en: [`First ${id}.`, `Second ${id}.`], zh_TW: [`第一段${id}。`] },
  metadata: { sources: ['https://example.org/a', 'https://zh.wikipedia.org/wiki/%E9%AD%81%E6%98%9F'], generated_by: 'agent; pending owner review', last_updated: '2026-10-13' },
  ...extra,
});

const P = [place('a', ['x', 'y']), place('b', ['y']), place('c', ['z']), place('d', [])];
// Deliberately not sorted by id: the functions must not depend on input order.
const T = [topic('temple-layout', ['c'], ['y']), topic('kuixing', ['a'], []), topic('folk-religion', [], ['x']), topic('zeta', [], ['nope'])];
const ids = list => list.map(x => x.id);

test('topicById, tolerating a bundle without topics', () => {
  assert.equal(topicById(T, 'kuixing').id, 'kuixing');
  assert.equal(topicById(T, 'nope'), undefined);
  assert.equal(topicById(undefined, 'kuixing'), undefined);
});

test('topicsForPlace: topics listing the place first, then topics sharing a tag, each group by id', () => {
  assert.deepEqual(ids(topicsForPlace(P[0], T)), ['kuixing', 'folk-religion', 'temple-layout']);
  assert.deepEqual(ids(topicsForPlace(P[1], T)), ['temple-layout']);
  assert.deepEqual(ids(topicsForPlace(P[2], T)), ['temple-layout']); // listed and not tagged
  assert.deepEqual(topicsForPlace(P[3], T), []);
  assert.deepEqual(topicsForPlace(P[0], undefined), []);
  assert.deepEqual(topicsForPlace({ id: 'q' }, [{ id: 't' }]), []); // no tags, no places: no match, no throw
});

test('topicsForPlace: a topic both listing and sharing a tag appears once', () => {
  const both = [topic('one', ['a'], ['x'])];
  assert.deepEqual(ids(topicsForPlace(P[0], both)), ['one']);
});

test('placesForTopic: listed places in topic order, then tag matches in guidebook order, each once', () => {
  assert.deepEqual(ids(placesForTopic(T[0], P)), ['c', 'a', 'b']);
  assert.deepEqual(ids(placesForTopic(topic('t', ['b', 'missing', 'a', 'b'], ['y']), P)), ['b', 'a']);
  assert.deepEqual(ids(placesForTopic(topic('t', [], ['nope']), P)), []);
  assert.deepEqual(ids(placesForTopic({ id: 't' }, P)), []);
});

const state = (lang, data) => ({ lang, data });

test('Learn list: every topic links to its page, with title and summary', () => {
  const html = renderLearn(state('en', { places: P, topics: T }));
  assert.match(html, /<h1>Learn about Taiwan<\/h1>/);
  assert.match(html, /href="#\/tips"/);
  const links = [...html.matchAll(/href="#\/learn\/([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, ids(T)); // data order (the bundle is sorted by id)
  assert.ok(html.includes('Title kuixing') && html.includes('Summary kuixing.'));
  assert.ok(renderLearn(state('zh_TW', { places: P, topics: T })).includes('標題kuixing'));
});

test('Learn list and pages work with a bundle that has no topics', () => {
  assert.match(renderLearn(state('en', { places: P })), /No topics yet\./);
  assert.match(renderLearn(state('en', { places: P }), 'kuixing'), /Topic not found\..*href="#\/learn"/s);
  assert.match(renderLearn(state('zh_TW', { places: P, topics: T }), 'nope'), /找不到這個主題。/);
});

test('Learn topic page: paragraphs, related places, sources, pending note', () => {
  const html = renderLearn(state('en', { places: P, topics: T }), 'temple-layout');
  assert.match(html, /<h1>Title temple-layout<\/h1>/);
  assert.match(html, /href="#\/learn"/);
  assert.ok(html.includes('<p>First temple-layout.</p>') && html.includes('<p>Second temple-layout.</p>'));
  const placeLinks = [...html.matchAll(/href="#\/place\/([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(placeLinks, ['c', 'a', 'b']);
  assert.match(html, /<h2>Sources<\/h2>/);
  assert.match(html, /<a href="https:\/\/example\.org\/a" target="_blank" rel="noopener">example\.org\/a<\/a>/);
  assert.ok(html.includes('>zh.wikipedia.org/wiki/魁星</a>'), 'percent-escapes decoded in the link text');
  assert.match(html, /class="muted small pending"/);
  assert.ok(isPending(T[0]));
});

test('Learn topic page in Chinese, without pending note once reviewed, without empty sections', () => {
  const reviewed = topic('t', [], [], { metadata: { sources: [], generated_by: 'owner', last_updated: '2026-10-13' } });
  const html = renderLearn(state('zh_TW', { places: P, topics: [reviewed] }), 't');
  assert.ok(html.includes('<h1>標題t</h1>') && html.includes('<p>第一段t。</p>'));
  assert.ok(!html.includes('First t.'));
  assert.ok(!isPending(reviewed));
  assert.doesNotMatch(html, /pending|相關景點|資料來源/);
});

test('Learn escapes data and links only https sources', () => {
  const bad = topic('x"y', [], [], {
    title: { en: '<script>alert(1)</script>' },
    body: { en: ['<img src=x onerror=alert(1)>'] },
    metadata: { sources: ['javascript:alert(1)', 'https://ok.example/"onmouseover="x'], generated_by: '' },
  });
  const list = renderLearn(state('en', { places: P, topics: [bad] }));
  assert.ok(list.includes('href="#/learn/x&quot;y"'));
  assert.ok(!list.includes('<script>'));
  const page = renderLearn(state('en', { places: P, topics: [bad] }), 'x"y');
  assert.ok(page.includes('&lt;script&gt;') && page.includes('&lt;img src=x'));
  assert.ok(!page.includes('href="javascript:'));
  assert.ok(page.includes('<li>javascript:alert(1)</li>'));
  assert.ok(!/<a href="https:\/\/ok\.example/.test(page), 'a URL with a quote is not linked');
});

test('bundle topics (when present) render and name only known places', { skip: !guidebook.topics?.length && 'no topics in the bundle yet' }, () => {
  const known = new Set(guidebook.places.map(p => p.id));
  for (const t of guidebook.topics) {
    for (const id of t.places || []) assert.ok(known.has(id), `${t.id}: unknown place ${id}`);
    for (const L of ['en', 'zh_TW']) assert.ok(renderLearn(state(L, guidebook), t.id).includes('<h1>'), t.id);
  }
});
