// The log form past midnight, in app/js/main.js driven in the fake browser (tests/fake-dom.js): a note is saved
// under the date the form shows, and coming back to the page on a new day draws the form again with that day
// (review: the form showed one date and saved another).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle } from '../fake-dom.js';
import { guidebook } from '../fixtures.js';

// A clock the test moves: new Date() and Date.now() read `now`; dates built from arguments are untouched.
const RealDate = Date;
let now = new RealDate(2026, 10, 3, 22, 0).getTime();
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
};

const dom = installDom({ hash: '#/log', guidebook });
dom.document.visibilityState = 'visible';
const { state } = await import('../../app/js/state.js');
await import('../../app/js/main.js');
await settle();

const dateField = () => /<input type="date" name="date" value="([^"]*)">/.exec(dom.view.innerHTML)?.[1];
/** Submit the log form, whose date input shows `shown`. */
const submit = shown => dom.view.listeners.submit[0]({
  target: { dataset: { form: 'log' }, elements: { date: { value: shown } } }, preventDefault() {},
});
const visibility = async v => {
  dom.document.visibilityState = v;
  dom.document.dispatch('visibilitychange');
  await settle();
};

test('a form drawn before midnight and saved after it saves the date it shows', () => {
  assert.equal(dateField(), '2026-11-03');
  now = new RealDate(2026, 10, 4, 0, 20).getTime();
  state.draft = { date: '', placeId: '', name: 'Night market', stars: 4, note: '' };
  submit(dateField());
  assert.equal(state.log.at(-1).date, '2026-11-03', 'the date on screen, not the day of saving');
  assert.equal(dateField(), '2026-11-04', 'the next note starts on the new day: the draft still follows today');
});

test('a date picked on purpose is kept whatever the form showed', () => {
  state.draft = { date: '2026-11-01', placeId: '', name: 'Tea', stars: 3, note: '' };
  submit('2026-11-01');
  assert.equal(state.log.at(-1).date, '2026-11-01');
});

test('coming back to the page on a new day draws the form with that day; the same day draws nothing', async () => {
  state.draft = { date: '', placeId: '', name: '', stars: 0, note: '' };
  now = new RealDate(2026, 10, 4, 23, 50).getTime();
  dom.view.innerHTML = 'untouched';
  await visibility('hidden');
  await visibility('visible');
  assert.equal(dom.view.innerHTML, 'untouched', 'same day: no re-render');

  now = new RealDate(2026, 10, 5, 0, 10).getTime();
  await visibility('hidden');
  assert.equal(dom.view.innerHTML, 'untouched', 'nothing is drawn while hidden');
  await visibility('visible');
  assert.equal(dateField(), '2026-11-05');
  state.draft = { date: '', placeId: '', name: 'Breakfast', stars: 3, note: '' };
  submit(dateField());
  assert.equal(state.log.at(-1).date, '2026-11-05', 'what is shown is what is saved');
});

test('a form event without the date input (older callers) still saves under today', () => {
  state.draft = { date: '', placeId: '', name: 'Snack', stars: 2, note: '' };
  dom.view.listeners.submit[0]({ target: { dataset: { form: 'log' } }, preventDefault() {} });
  assert.equal(state.log.at(-1).date, '2026-11-05');
});
