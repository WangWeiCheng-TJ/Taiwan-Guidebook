// "Taiwan through the places": every place's timeline merged and grouped under eras (app/js/timeline.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIMELINE_ID, ERA_KEYS, parseYear, eraSpan, eventEra, mergeTimeline, eraLabel } from '../../app/js/timeline.js';
import { tr } from '../../app/js/lang.js';
import { guidebook } from '../fixtures.js';

const schema = JSON.parse(readFileSync(new URL('../../schema/attraction.schema.json', import.meta.url), 'utf8'));
const SCHEMA_ERAS = schema.properties.eras.items.enum;
const [PREHISTORIC, DUTCH, TUNGNING, QING, JAPANESE, MODERN] = SCHEMA_ERAS;

test('the route argument is "timeline"', () => {
  assert.equal(TIMELINE_ID, 'timeline');
});

test('parseYear: the first 4-digit year; a range by its start; none for "Present"', () => {
  assert.equal(parseYear('1653'), 1653);
  assert.equal(parseYear('1895–1945'), 1895);
  assert.equal(parseYear('1895-1920'), 1895);
  assert.equal(parseYear('1646–1661'), 1646);
  assert.equal(parseYear('2000s'), 2000);
  assert.equal(parseYear('c. 1700'), 1700);
  assert.equal(parseYear('Present'), null);
  assert.equal(parseYear('17th century'), null);
  assert.equal(parseYear('12345'), null, 'not four digits');
  assert.equal(parseYear(''), null);
  assert.equal(parseYear(undefined), null);
});

test('eraSpan: the years in an era name; present is open-ended; none without years', () => {
  assert.deepEqual(eraSpan(QING), { start: 1683, end: 1895 });
  assert.deepEqual(eraSpan(MODERN), { start: 1945, end: Infinity });
  assert.deepEqual(eraSpan('Something (1700-1800)'), { start: 1700, end: 1800 });
  assert.equal(eraSpan(PREHISTORIC), null);
  assert.equal(eraSpan(''), null);
});

const ALL = [DUTCH, TUNGNING, QING, JAPANESE, MODERN];
const ev = (year_or_era, era_category) => ({ year_or_era, era_category, event_en: 'E', event_zh: '事' });

test('eventEra: the era_category\'s words pick the era ("Late Qing", "Post-WWII", "Kingdom of Tungning")', () => {
  assert.equal(eventEra(ev('1853', 'Late Qing'), [QING], ALL), QING);
  assert.equal(eventEra(ev('1867', 'Qing / British Lease'), [QING], ALL), QING);
  assert.equal(eventEra(ev('1971', 'Post-WWII'), [MODERN], ALL), MODERN);
  assert.equal(eventEra(ev('1661', 'Kingdom of Tungning'), [DUTCH, TUNGNING], ALL), TUNGNING, 'a boundary year');
  assert.equal(eventEra(ev('1895-1920', 'Japanese Colonial'), [JAPANESE], ALL), JAPANESE);
  assert.equal(eventEra(ev('1644', 'Dutch Formosa'), [DUTCH], ALL), DUTCH);
});

test('eventEra: a word in several era names ("Era") does not count; then the years decide', () => {
  assert.equal(eventEra(ev('1961', 'Modern Era'), [MODERN], ALL), MODERN);
  // "Spanish" names the Dutch & Spanish era, "Colonial" the Japanese one: 1628 settles it
  assert.equal(eventEra(ev('1628', 'Spanish Colonial'), [DUTCH, QING], ALL), DUTCH);
  assert.equal(eventEra(ev('1930', 'Spanish Colonial'), [DUTCH, JAPANESE], ALL), JAPANESE);
});

test('eventEra: no matching words: the era whose years hold the year, even one the place does not list', () => {
  assert.equal(eventEra(ev('1646–1661', 'Late Ming'), [QING, JAPANESE, MODERN], ALL), DUTCH);
  assert.equal(eventEra(ev('1900'), [JAPANESE], ALL), JAPANESE, 'no era_category at all');
  assert.equal(eventEra(ev('2000s', ''), [MODERN], ALL), MODERN);
});

test('eventEra: a year two eras share goes to the place\'s own era, else to the era that began then', () => {
  assert.equal(eventEra(ev('1661'), [DUTCH, QING], ALL), DUTCH, 'the place lists Dutch & Spanish only');
  assert.equal(eventEra(ev('1661'), [QING], ALL), TUNGNING, 'neither listed: the later start');
  assert.equal(eventEra(ev('1895'), [], ALL), JAPANESE);
});

test('eventEra: "Present" goes to an era running to the present; nothing to go on gives ""', () => {
  assert.equal(eventEra(ev('Present', 'Modern Era'), [MODERN], ALL), MODERN);
  assert.equal(eventEra(ev('Present'), [QING, MODERN], ALL), MODERN, 'no era_category: the open-ended era');
  assert.equal(eventEra(ev('Present'), [QING], [QING]), '', 'no era runs to the present');
  assert.equal(eventEra(ev('17th century', 'Late Ming'), [QING, MODERN], ALL), '');
  assert.equal(eventEra(ev('1500'), [DUTCH], ALL), '', 'before every era, no words');
  assert.equal(eventEra(ev('1700', 'Qing'), [], []), '', 'no eras in the guide');
  assert.equal(eventEra(ev('Long ago', 'Indigenous'), [], [PREHISTORIC, QING]), PREHISTORIC, 'an era without years, by words');
});

const place = (id, eras, timeline, generated_by = 'Curatorial Team') => ({
  id, eras, timeline, metadata: { generated_by },
  name: { en: `Place ${id}`, zh_TW: `景點${id}` },
});

const A = place('a', [QING, MODERN], [ev('1890', 'Qing Dynasty'), ev('Present', 'Modern Era'), ev('1989', 'Modern Era')]);
const B = place('b', [DUTCH, QING, MODERN], [ev('1628', 'Spanish Colonial'), ev('1890', 'Late Qing'), ev('1980', 'Modern Era')]);
const C = place('c', [JAPANESE, MODERN], [ev('1926', 'Japanese Colonial'), ev('2000s', 'Modern Era'), ev('Someday', 'Unknown')],
  'agy draft; pending owner review');
const shape = groups => groups.map(g => [g.era, g.events.map(e => `${e.place.id}:${e.when}`)]);

test('mergeTimeline: eras in the order of their years, events by year, undated last, unfitted events last', () => {
  assert.deepEqual(shape(mergeTimeline([A, B, C])), [
    [DUTCH, ['b:1628']],
    [QING, ['a:1890', 'b:1890']], // equal years keep guidebook order
    [JAPANESE, ['c:1926']],
    [MODERN, ['b:1980', 'a:1989', 'c:2000s', 'a:Present']],
    ['', ['c:Someday']],
  ]);
});

test('mergeTimeline: equal years follow the guidebook order of the places, then each place\'s own order', () => {
  const X = place('x', [QING], [ev('1700', 'Qing'), ev('1700 again', 'Qing')]);
  const Y = place('y', [QING], [ev('1700', 'Qing')]);
  assert.deepEqual(shape(mergeTimeline([Y, X])), [[QING, ['y:1700', 'x:1700', 'x:1700 again']]]);
});

test('mergeTimeline: each event keeps its text, its place, its parsed year and the place\'s pending mark', () => {
  const groups = mergeTimeline([A, C]);
  const e = groups.flatMap(g => g.events).find(x => x.when === '2000s');
  assert.deepEqual({ ...e, place: e.place.id }, { when: '2000s', year: 2000, event_en: 'E', event_zh: '事', place: 'c', pending: true });
  assert.ok(groups.flatMap(g => g.events).filter(x => x.place.id === 'a').every(x => x.pending === false));
});

test('mergeTimeline: no places, places without a timeline, and damaged entries', () => {
  assert.deepEqual(mergeTimeline([]), []);
  assert.deepEqual(mergeTimeline(undefined), []);
  assert.deepEqual(mergeTimeline([{ id: 'q', eras: [QING] }, { id: 'r' }]), []);
  const odd = { id: 'o', eras: [QING], timeline: [null, 'text', { year_or_era: '1700' }] };
  assert.deepEqual(mergeTimeline([odd]).map(g => [g.era, g.events.map(e => [e.when, e.event_en, e.event_zh])]),
    [[QING, [['1700', '', '']]]]);
});

test('mergeTimeline on the guidebook: every event once, each under one of the places\' eras, in year order', () => {
  const groups = mergeTimeline(guidebook.places);
  const total = guidebook.places.reduce((n, p) => n + p.timeline.length, 0);
  assert.equal(groups.reduce((n, g) => n + g.events.length, 0), total);
  const eras = new Set(guidebook.places.flatMap(p => p.eras));
  for (const g of groups) {
    assert.ok(g.era === '' || eras.has(g.era), g.era);
    const years = g.events.map(e => e.year ?? Infinity);
    assert.deepEqual(years, [...years].sort((a, b) => a - b), g.era);
  }
  const starts = groups.filter(g => g.era).map(g => eraSpan(g.era)?.start ?? -Infinity);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
  // the data's own labels land where they say
  const where = (id, when) => groups.find(g => g.events.some(e => e.place.id === id && e.when === when))?.era;
  assert.equal(where('chihkan-tower', '1661'), TUNGNING);
  assert.equal(where('fort-san-domingo', '1628'), DUTCH);
  assert.equal(where('fort-san-domingo', '1867'), QING);
  assert.equal(where('tainan-confucius-temple', 'Present'), MODERN);
});

test('ERA_KEYS: exactly the schema\'s eras, in order; each heading in both languages, English as in the data', () => {
  assert.deepEqual(Object.keys(ERA_KEYS), SCHEMA_ERAS);
  for (const [name, key] of Object.entries(ERA_KEYS)) {
    assert.equal(tr('en', `era.${key}`), name);
    assert.notEqual(tr('zh_TW', `era.${key}`), name, `zh_TW ${key}`);
  }
});

test('eraLabel: a schema era in the UI language, "" as Other times, an unknown era as written', () => {
  assert.equal(eraLabel(QING, 'en'), QING);
  assert.equal(eraLabel(QING, 'zh_TW'), '清治時期（1683–1895）');
  assert.equal(eraLabel(JAPANESE, 'zh_TW'), '日治時期（1895–1945）');
  assert.equal(eraLabel('', 'en'), 'Other times');
  assert.equal(eraLabel('', 'zh_TW'), '其他時期');
  assert.equal(eraLabel('Late Ming', 'zh_TW'), 'Late Ming');
});
