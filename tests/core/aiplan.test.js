// Contract for TASK T2 (app/js/aiplan.js). Do not edit these tests to make them pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planRequestSuffix, extractJsonBlock, planFromAiText } from '../../app/js/aiplan.js';
import { places } from '../fixtures.js';

const plan = { title: 'Tomorrow', days: [{ date: '2026-11-04', items: [{ name: 'chihkan tower (fort provintia)' }, { name: '赤崁樓' }, { name: 'Curry shop' }] }] };

test('planRequestSuffix asks for one fenced json block in the Trip shape', () => {
  const s = planRequestSuffix();
  assert.match(s, /```json/);
  assert.match(s, /"days"/);
  assert.match(s, /"place"/);
  assert.match(s, /"name"/);
});

test('extractJsonBlock prefers ```json, then ``` with {, then a balanced span', () => {
  const a = 'Here you go:\n```json\n{"a":1}\n```\nand ```json\n{"b":2}\n```';
  assert.equal(JSON.parse(extractJsonBlock(a)).a, 1);
  const b = 'Plan:\n```\n{"c":3}\n```';
  assert.equal(JSON.parse(extractJsonBlock(b)).c, 3);
  const c = 'Sure! {"title":"x","note":"use } carefully","days":[]} Enjoy.';
  assert.deepEqual(JSON.parse(extractJsonBlock(c)), { title: 'x', note: 'use } carefully', days: [] });
  assert.equal(extractJsonBlock('no json here'), null);
});

test('planFromAiText links names to guidebook ids', () => {
  const text = 'Great choice!\n```json\n' + JSON.stringify(plan) + '\n```';
  const { trip, errors } = planFromAiText(text, places);
  assert.deepEqual(errors, []);
  const items = trip.days[0].items;
  assert.equal(items[0].place, 'chihkan-tower');
  assert.equal(items[1].place, 'chihkan-tower');
  assert.equal(items[2].place, undefined);
  assert.equal(items[2].name, 'Curry shop');
});

test('planFromAiText error messages', () => {
  assert.deepEqual(planFromAiText('just words', places), { trip: null, errors: ['No plan found in the text.'] });
  assert.deepEqual(planFromAiText('```json\n{not json}\n```', places), { trip: null, errors: ['The plan is not valid JSON.'] });
  const invalid = planFromAiText('```json\n{"title":"x","days":[]}\n```', places);
  assert.equal(invalid.trip, null);
  assert.ok(invalid.errors.length > 0);
});
