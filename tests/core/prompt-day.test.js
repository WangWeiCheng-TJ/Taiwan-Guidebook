// The trip day in the Ask AI prompt is never 0 or negative (audit logic #13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAskPrompt } from '../../app/js/prompt.js';
import { places } from '../fixtures.js';

const entry = date => ({ id: date, date, placeId: null, name: 'x', stars: 3, note: '' });
const first = log => buildAskPrompt({
  mode: 'plan', pos: null, radius: 3, area: '', customArea: '', day: 'tomorrow', question: null,
  includeLog: true, log, places, today: '2026-11-03',
}).split('\n\n')[0];

test('buildAskPrompt: no day number when every log date is after today', () => {
  assert.equal(first([entry('2026-11-10')]), "I'm a visitor traveling in Taiwan. Today is 2026-11-03.");
  assert.equal(first([entry('2026-11-04')]), "I'm a visitor traveling in Taiwan. Today is 2026-11-03.");
});

test('buildAskPrompt: day 1 on the first logged date, counting from the earliest entry', () => {
  assert.match(first([entry('2026-11-03')]), /\(day 1 of my trip\)\.$/);
  assert.match(first([entry('2026-11-10'), entry('2026-11-01')]), /\(day 3 of my trip\)\.$/);
  assert.equal(first([]), "I'm a visitor traveling in Taiwan. Today is 2026-11-03.");
});
