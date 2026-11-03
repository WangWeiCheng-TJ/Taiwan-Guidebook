// The Ask AI prompt names the party only once the traveler has set it (audit logic #9),
// and a Chinese typed area brings in that city's food picks (audit logic #2, through askContext).
import test from 'node:test';
import assert from 'node:assert/strict';
import { partyChosen, clampParty } from '../../app/js/party.js';
import { buildAskPrompt } from '../../app/js/prompt.js';
import { state } from '../../app/js/state.js';
import { askContext } from '../../app/js/views/ask.js';
import { guidebook } from '../fixtures.js';

test('partyChosen: only a stored number counts as set', () => {
  for (const x of [1, 2, 10, 0, 12, 2.5]) assert.equal(partyChosen(x), true, String(x));
  for (const x of [null, undefined, '3', NaN, Infinity, {}, []]) assert.equal(partyChosen(x), false, String(x));
  assert.equal(clampParty(null), 2, 'phrases still use 2 while unset');
});

/**
 * askContext for the app state with these changes, with the guidebook loaded.
 * @param {object} over
 */
function ctxFor(over) {
  const prev = state.data;
  state.data = guidebook;
  try {
    return askContext({ ...state, data: guidebook, log: [], trip: null, pos: null, ...over });
  } finally {
    state.data = prev;
  }
}
const firstParagraph = c => buildAskPrompt(c).split('\n\n')[0];

test('askContext: no party until it is set, so the prompt says nothing about it', () => {
  const c = ctxFor({ party: 2, partySet: false });
  assert.equal(c.party, null);
  assert.doesNotMatch(firstParagraph(c), /We are|traveling alone/);
});

test('askContext: a set party is passed on, including 2', () => {
  assert.equal(ctxFor({ party: 2, partySet: true }).party, 2);
  assert.match(firstParagraph(ctxFor({ party: 2, partySet: true })), / We are 2 people\.$/);
  assert.match(firstParagraph(ctxFor({ party: 1, partySet: true })), / I'm traveling alone\.$/);
});

test('askContext: a typed Chinese area picks that city for the food picks', () => {
  const ask = { ...state.ask, mode: 'plan', area: '', customArea: '台南' };
  const c = ctxFor({ ask, party: 2, partySet: false });
  assert.equal(c.food?.city_en, 'Tainan City');
  assert.match(buildAskPrompt(c), /Places to eat that a local friend recommends in Tainan City/);
});
