import { esc, today } from '../util.js';
import { areaLabel, areaOptions, buildAskPrompt, defaultQuestion } from '../prompt.js';
import { places } from '../state.js';
import { tr } from '../lang.js';
import { locationPanel } from './common.js';

/**
 * Collect the AskContext for buildAskPrompt from app state.
 * @param {import('../state.js').AppState} s
 * @returns {import('../types.js').AskContext}
 */
export function askContext(s) {
  return { ...s.ask, pos: s.pos, log: s.log, places: places(), today: today(), trip: s.trip, lang: s.lang };
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
 * Ask AI tab (#/ask): mode switch, mode fields, question, toggles, copy button, live preview.
 * near mode: location panel + radius (data-change="radius").
 * plan mode: day (data-change="day"), area select (data-change="area"), custom area input (data-input="custom-area").
 * Shared: data-input="question", data-change="include-log" | "want-plan", data-action="mode" data-mode, data-action="copy-prompt".
 * The preview lives in #prompt-preview so main.js can refresh it without re-rendering (keeps input focus).
 * Area option labels stay English: they are what the AI reads.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderAsk(s) {
  const L = s.lang;
  const a = s.ask;
  const custom = a.area === 'custom' || !a.area;
  const areaOpts = areaOptions(places()).map(o =>
    `<option value="${esc(o.value)}" ${a.area === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');

  const modeFields = a.mode === 'near' ? `
    ${locationPanel(s)}
    <label>${tr(L, 'within')}
      <select data-change="radius">
        ${[1, 2, 3, 5, 10, 25].map(r => `<option value="${r}" ${a.radius === r ? 'selected' : ''}>${r} km</option>`).join('')}
      </select>
    </label>` : `
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

  return `
    <h1>${tr(L, 'askTitle')}</h1>
    <p class="muted small">${tr(L, 'askIntro')}</p>
    <div class="seg">
      <button class="${a.mode === 'near' ? 'on' : ''}" data-action="mode" data-mode="near">${tr(L, 'nearMe')}</button>
      <button class="${a.mode === 'plan' ? 'on' : ''}" data-action="mode" data-mode="plan">${tr(L, 'planDay')}</button>
    </div>
    ${modeFields}
    <div class="stack" style="margin-top:12px">
      <label>${tr(L, 'yourQuestion')}
        <textarea data-input="question" rows="3">${esc(questionText(s))}</textarea>
      </label>
      <label class="row" style="color:var(--text)">
        <input type="checkbox" data-change="include-log" ${a.includeLog ? 'checked' : ''} style="width:auto">
        ${tr(L, 'includeNotes', { n: s.log.length })}
      </label>
      <label class="row" style="color:var(--text)">
        <input type="checkbox" data-change="want-plan" ${a.wantPlan ? 'checked' : ''} style="width:auto">
        ${tr(L, 'wantPlan')}
      </label>
      <button class="btn primary" data-action="copy-prompt">${tr(L, 'copyQuestion')}</button>
      <div class="row small">
        <span class="muted">${tr(L, 'thenOpen')}</span>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
        <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
        <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
      </div>
    </div>
    <details>
      <summary>${tr(L, 'preview')}</summary>
      <pre class="prompt" id="prompt-preview">${esc(buildAskPrompt(askContext(s)))}</pre>
    </details>
  `;
}
