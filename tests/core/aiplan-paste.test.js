// Pasting the request together with the answer still loads the answer's plan (audit logic #12).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planRequestSuffix, extractJsonBlock, planFromAiText } from '../../app/js/aiplan.js';
import { buildAskPrompt } from '../../app/js/prompt.js';
import { places } from '../fixtures.js';

const real = { title: 'Real day', days: [{ date: '2026-11-04', items: [{ place: 'chihkan-tower' }, { name: 'Noodles' }] }] };
const answer = `Here is a relaxed day.\n\n\`\`\`json\n${JSON.stringify(real)}\n\`\`\`\n\nEnjoy!`;
const request = buildAskPrompt({
  mode: 'plan', pos: null, radius: 3, area: 'city:Tainan City', customArea: '', day: 'tomorrow', question: null,
  includeLog: false, log: [], places, today: '2026-11-03', wantPlan: true,
});

test('the request text itself ends with the suffix, whose example is in a ```json block', () => {
  assert.ok(request.endsWith(planRequestSuffix()));
  assert.match(planRequestSuffix(), /exactly one ```json code block/);
});

test('planFromAiText: request followed by the answer loads the answer', () => {
  const { trip, errors } = planFromAiText(`${request}\n\n${answer}`, places);
  assert.deepEqual(errors, []);
  assert.equal(trip.title, 'Real day');
  assert.deepEqual(trip.days[0].items, [{ place: 'chihkan-tower' }, { name: 'Noodles' }]);
});

test('planFromAiText: the same with a copy that re-spaced the example', () => {
  const respaced = request.replace(/\{"title":"Tainan day",/, '{ "title": "Tainan day",\n  ');
  assert.notEqual(respaced, request);
  assert.equal(planFromAiText(`${respaced}\n\n${answer}`, places).trip?.title, 'Real day');
});

test('planFromAiText: request followed by an answer whose JSON is not fenced', () => {
  const bare = `Here is a relaxed day: ${JSON.stringify(real)} Enjoy!`;
  assert.equal(planFromAiText(`${request}\n\n${bare}`, places).trip?.title, 'Real day');
  const plainFence = `Plan:\n\`\`\`\n${JSON.stringify(real)}\n\`\`\``;
  assert.equal(planFromAiText(`${request}\n\n${plainFence}`, places).trip?.title, 'Real day');
});

test('planFromAiText: the request alone has no plan in it', () => {
  assert.deepEqual(planFromAiText(request, places), { trip: null, errors: ['No plan found in the text.'] });
});

test('extractJsonBlock: words that mention ```json are not a fence', () => {
  const text = 'Put it in one ```json code block, please.\n```json\n{"a":1}\n```';
  assert.deepEqual(JSON.parse(extractJsonBlock(text)), { a: 1 });
  assert.deepEqual(JSON.parse(extractJsonBlock('```json {"b":2}```')), { b: 2 });
});

test('extractJsonBlock: a broken ```json block before a good one gives the good one; alone it is still returned', () => {
  const text = '```json\n{"a":\n```\nFixed:\n```json\n{"a":1}\n```';
  assert.deepEqual(JSON.parse(extractJsonBlock(text)), { a: 1 });
  assert.deepEqual(planFromAiText('```json\n{"a":\n```', places), { trip: null, errors: ['The plan is not valid JSON.'] });
});
