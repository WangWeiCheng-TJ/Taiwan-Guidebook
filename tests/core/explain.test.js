import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExplainPrompt } from '../../app/js/prompt.js';

test('English question with context and source', () => {
  const p = buildExplainPrompt({ text: ' bixi ', context: 'Each stele rides on a bixi, the turtle-like son of the dragon.', source: 'Chihkan Tower' });
  assert.match(p, /^I'm a visitor in Taiwan.*What does "bixi" mean here\?/);
  assert.match(p, /Context: "Each stele rides on a bixi/);
  assert.match(p, /From: Chihkan Tower$/);
});

test('Chinese UI asks in Chinese and requests a Chinese reply', () => {
  const p = buildExplainPrompt({ text: '贔屭', context: '每座石碑由形似烏龜的贔屭馱著。', source: '赤崁樓', lang: 'zh_TW' });
  assert.match(p, /這裡的「贔屭」是什麼意思/);
  assert.match(p, /上下文：「每座石碑由形似烏龜的贔屭馱著。」/);
  assert.match(p, /Traditional Chinese \(Taiwan\)\.$/);
});

test('long selections and contexts are cut; context equal to the text is dropped', () => {
  const p = buildExplainPrompt({ text: 'x'.repeat(200), context: 'y'.repeat(1000) });
  assert.ok(p.includes('x'.repeat(79) + '…'));
  assert.ok(p.includes('y'.repeat(299) + '…'));
  assert.doesNotMatch(buildExplainPrompt({ text: 'temple', context: 'temple' }), /Context:/);
  assert.doesNotMatch(buildExplainPrompt({ text: 'temple' }), /From:/);
});
