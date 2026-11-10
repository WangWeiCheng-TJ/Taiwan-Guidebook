import { esc, nowTime, today } from '../util.js';
import { areaLabel, areaOptions, areaPlaces, buildAskPrompt, buildPhotoPrompt, defaultQuestion, PHOTO_KINDS } from '../prompt.js';
import { foodFor } from '../data.js';
import { distanceTo, sortByDistance } from '../geo.js';
import { places } from '../state.js';
import { tr } from '../lang.js';
import { aiLinks, cityName, locationPanel } from './common.js';
import { partyControl } from './reference.js';
import { ASK_LATER_SHOWN, laterLabel, laterTime } from '../asklater.js';

/** Icons of the photo presets (decorative). */
const PHOTO_ICONS = { menu: '🍽️', sign: '🪧', board: '🚆', machine: '🎫', label: '🏷️' };

/**
 * Collect the AskContext for buildAskPrompt from app state.
 * party is null until the traveler has set it (s.partySet), so a fresh install does not tell the AI
 * "We are 2 people" for someone traveling alone.
 * @param {import('../state.js').AppState} s
 * @returns {import('../types.js').AskContext}
 */
export function askContext(s) {
  return { ...s.ask, pos: s.pos, log: s.log, places: places(), today: today(), trip: s.trip, lang: s.lang,
    party: s.partySet ? s.party : null, food: foodFor(s.data?.food, askCity(s)) };
}

/**
 * The city the question is about, for the owner's food picks: the planned area's city, the picked city,
 * or the city of the nearest guidebook place when it is within 15 km of GPS.
 * @param {import('../state.js').AppState} s
 * @returns {string|null}
 */
function askCity(s) {
  const a = s.ask;
  if (a.mode === 'plan') {
    if (a.area.startsWith('city:')) return a.area.slice(5);
    if (a.area.startsWith('district:')) return a.area.slice(9).split('|')[0];
    return areaPlaces(places(), a.area, a.customArea)[0]?.location.city_en || null;
  }
  if (s.pos?.city) return s.pos.city;
  const nearest = s.pos && sortByDistance(places(), s.pos)[0];
  return nearest && distanceTo(nearest, s.pos) <= 15 ? nearest.location.city_en : null;
}

/**
 * Collect the PhotoContext for buildPhotoPrompt from app state. The party follows the same rule as askContext.
 * @param {import('../state.js').AppState} s
 * @param {import('../types.js').PhotoShop|null} [shop]  the food pick or dish of "Ask AI about the menu"; that
 *   prompt leaves out the Ask AI tab's note, which was written for another photo
 * @returns {import('../types.js').PhotoContext}
 */
export function photoContext(s, shop = null) {
  return { pos: s.pos, places: places(), today: today(), time: nowTime(), trip: s.trip,
    party: s.partySet ? s.party : null, shop, note: shop ? '' : s.ask.photoNote || '' };
}

/**
 * The prompt the Ask AI tab shows and copies: buildPhotoPrompt in the photo mode, buildAskPrompt otherwise.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function currentPrompt(s) {
  return s.ask.mode === 'photo' ? buildPhotoPrompt(photoContext(s), s.ask.photo, s.lang) : buildAskPrompt(askContext(s));
}

/**
 * The question box text: the user's edit, or the default for the current mode/day/area/language.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function questionText(s) {
  const a = s.ask;
  return a.question ?? defaultQuestion(a.mode, a.day, areaLabel(a.area, a.customArea), s.lang);
}

/**
 * What the Ask later list says about the prompt the Ask AI tab copies (laterItem's kind, subject and where):
 * near me: the question and the picked city; plan a day: the area (the question when none is chosen); photo: the
 * preset (a PHOTO_KINDS id) and the picked city. GPS gives no place name: where is "" then.
 * @param {import('../state.js').AppState} s
 * @returns {{ kind: 'near'|'plan'|'photo', subject: string, where: string }}
 */
export function laterInfo(s) {
  const a = s.ask;
  const where = s.pos?.city ? cityName(s.pos.city, s.lang) : '';
  if (a.mode === 'photo') return { kind: 'photo', subject: a.photo, where };
  if (a.mode === 'plan') return { kind: 'plan', subject: areaLabel(a.area, a.customArea) || questionText(s), where: '' };
  return { kind: 'near', subject: questionText(s), where };
}

/**
 * Ask later, at the top of the Ask AI tab: the prompts copied before (s.later, newest first), each with its label
 * and time, "copied offline" while it waits, Copy (data-action="later-copy" data-id) and Delete
 * (data-action="later-delete" data-id); Clear all (data-action="later-clear"). Only the newest ASK_LATER_SHOWN
 * unless s.laterAll; the toggle is data-action="later-all" with aria-expanded. "" when the list is empty.
 * main.js re-renders it alone inside #ask-later (refreshLater), so an open Preview stays open after a copy.
 * @param {import('../state.js').AppState} s
 * @param {Date} [now]  for the times
 * @returns {string}
 */
export function renderLater(s, now = new Date()) {
  const L = s.lang;
  const list = s.later || [];
  if (!list.length) return '';
  const shown = s.laterAll ? list : list.slice(0, ASK_LATER_SHOWN);
  const more = list.length > ASK_LATER_SHOWN;
  return `
    <section class="panel later" aria-labelledby="later-title">
      <div class="row spread">
        <h2 id="later-title">${tr(L, 'later.title')}</h2>
        <button class="btn small" type="button" data-action="later-clear">${tr(L, 'later.clear')}</button>
      </div>
      <p class="muted small">${tr(L, 'later.intro')}</p>
      ${shown.map(item => {
        const label = laterLabel(item, L);
        return `<div class="card later-item">
        <div>
          <div class="title">${esc(label)}</div>
          <div class="meta">${esc(laterTime(item, now))}${item.waiting ? ` <span class="badge warm">${tr(L, 'later.waiting')}</span>` : ''}</div>
        </div>
        <div class="row">
          <button class="btn small" type="button" data-action="later-copy" data-id="${esc(item.id)}" aria-label="${esc(tr(L, 'later.copyLabel', { t: label }))}">${tr(L, 'later.copy')}</button>
          <button class="btn small danger" type="button" data-action="later-delete" data-id="${esc(item.id)}" aria-label="${esc(tr(L, 'later.deleteLabel', { t: label }))}">✕</button>
        </div>
      </div>`;
      }).join('')}
      ${more ? `<button class="btn small" type="button" data-action="later-all" aria-expanded="${!!s.laterAll}">${
        s.laterAll ? tr(L, 'later.showFewer') : tr(L, 'later.showAll', { n: list.length })}</button>` : ''}
    </section>`;
}

/**
 * Ask AI tab (#/ask): Ask later (renderLater, in #ask-later), mode switch, mode fields, party size, question, toggles, copy button, live preview.
 * near mode: location panel + radius (data-change="radius"; not shown for a picked city, whose places are all listed).
 * plan mode: day (data-change="day"), area select (data-change="area"), custom area input (data-input="custom-area").
 * photo mode ("About a photo"): location panel, the presets as radio buttons (data-change="photo-kind",
 * value = a PHOTO_KINDS id; changing one needs no re-render), and an optional note (data-input="photo-note")
 * instead of the question box and the two toggles.
 * Shared: data-action="party-dec" | "party-inc", data-input="question", data-change="include-log" | "want-plan",
 * data-action="mode" data-mode (aria-pressed on the current one), data-action="copy-prompt".
 * The preview (currentPrompt) lives in #prompt-preview so main.js can refresh it without re-rendering (keeps
 * input focus). Area option labels stay English (lang="en"): they are what the AI reads.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderAsk(s) {
  const L = s.lang;
  const a = s.ask;
  const photo = a.mode === 'photo';
  const custom = a.area === 'custom' || !a.area;
  const areaOpts = areaOptions(places()).map(o =>
    `<option value="${esc(o.value)}" lang="en" ${a.area === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');

  // A picked city lists all its places (buildAskPrompt), so the radius only applies to GPS.
  const modeFields = photo ? `
    ${locationPanel(s)}
    <fieldset class="kinds">
      <legend>${tr(L, 'photoWhat')}</legend>
      ${PHOTO_KINDS.map(k => `<label class="kind">
        <input type="radio" name="photo-kind" value="${k}" data-change="photo-kind" ${a.photo === k ? 'checked' : ''}>
        <span class="kind-icon" aria-hidden="true">${PHOTO_ICONS[k]}</span>
        <span>${tr(L, `photo.${k}`)}<span class="muted small">${tr(L, `photo.${k}.hint`)}</span></span>
      </label>`).join('')}
    </fieldset>` : a.mode === 'near' ? `
    ${locationPanel(s)}
    ${s.pos?.source === 'pick' ? '' : `<label>${tr(L, 'within')}
      <select data-change="radius">
        ${[1, 2, 3, 5, 10, 25].map(r => `<option value="${r}" ${a.radius === r ? 'selected' : ''}>${r} km</option>`).join('')}
      </select>
    </label>`}` : `
    <div class="stack">
      <label>${tr(L, 'when')}
        <select data-change="day">
          <option value="tomorrow" ${a.day === 'tomorrow' ? 'selected' : ''}>${tr(L, 'tomorrow')}</option>
          <option value="today" ${a.day === 'today' ? 'selected' : ''}>${tr(L, 'todayOpt')}</option>
        </select>
      </label>
      <label>${tr(L, 'area')}
        <select data-change="area">
          <option value="custom" ${custom ? 'selected' : ''}>${tr(L, 'typeArea')}</option>
          ${areaOpts}
        </select>
      </label>
      ${custom ? `<label>${tr(L, 'areaName')}
        <input data-input="custom-area" value="${esc(a.customArea)}" placeholder="${esc(tr(L, 'areaPh'))}">
      </label>` : ''}
    </div>`;

  const seg = (mode, key) =>
    `<button class="${a.mode === mode ? 'on' : ''}" data-action="mode" data-mode="${mode}" aria-pressed="${a.mode === mode}">${tr(L, key)}</button>`;
  const fields = photo ? `
      <label>${tr(L, 'photoNote')}
        <textarea data-input="photo-note" rows="2" placeholder="${esc(tr(L, 'photoNotePh'))}">${esc(a.photoNote)}</textarea>
      </label>` : `
      <label>${tr(L, 'yourQuestion')}
        <textarea data-input="question" rows="3">${esc(questionText(s))}</textarea>
      </label>
      <label class="row check" style="color:var(--text)">
        <input type="checkbox" data-change="include-log" ${a.includeLog ? 'checked' : ''}>
        ${tr(L, 'includeNotes', { n: s.log.length })}
      </label>
      <label class="row check" style="color:var(--text)">
        <input type="checkbox" data-change="want-plan" ${a.wantPlan ? 'checked' : ''}>
        ${tr(L, 'wantPlan')}
      </label>`;

  return `
    <h1>${tr(L, 'askTitle')}</h1>
    <div id="ask-later">${renderLater(s)}</div>
    <p class="muted small">${tr(L, photo ? 'photoIntro' : 'askIntro')}</p>
    <div class="seg">
      ${seg('near', 'nearMe')}
      ${seg('plan', 'planDay')}
      ${seg('photo', 'photoMode')}
    </div>
    ${modeFields}
    <div class="stack" style="margin-top:12px">
      ${partyControl(L, s.party)}
      ${fields}
      <button class="btn primary" data-action="copy-prompt">${tr(L, 'copyQuestion')}</button>
      ${aiLinks(L)}
    </div>
    <details>
      <summary>${tr(L, 'preview')}</summary>
      <pre class="prompt" id="prompt-preview">${esc(currentPrompt(s))}</pre>
    </details>
  `;
}
