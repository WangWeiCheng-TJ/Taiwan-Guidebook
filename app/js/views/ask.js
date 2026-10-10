import { esc, today } from '../util.js';
import { areaLabel, areaOptions, buildAskPrompt, defaultQuestion } from '../prompt.js';
import { places } from '../state.js';
import { locationPanel } from './common.js';

/**
 * Collect the AskContext for buildAskPrompt from app state.
 * @param {import('../state.js').AppState} s
 * @returns {import('../types.js').AskContext}
 */
export function askContext(s) {
  return { ...s.ask, pos: s.pos, log: s.log, places: places(), today: today() };
}

/**
 * The question box text: the user's edit, or the default for the current mode/day/area.
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function questionText(s) {
  const a = s.ask;
  return a.question ?? defaultQuestion(a.mode, a.day, areaLabel(a.area, a.customArea));
}

/**
 * Ask AI tab (#/ask): mode switch, mode fields, question, include-notes toggle, copy button, live preview.
 * near mode: location panel + radius (data-change="radius").
 * plan mode: day (data-change="day"), area select (data-change="area"), custom area input (data-input="custom-area").
 * Shared: data-input="question", data-change="include-log", data-action="mode" data-mode, data-action="copy-prompt".
 * The preview lives in #prompt-preview so main.js can refresh it without re-rendering (keeps input focus).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function renderAsk(s) {
  const a = s.ask;
  const custom = a.area === 'custom' || !a.area;
  const areaOpts = areaOptions(places()).map(o =>
    `<option value="${esc(o.value)}" ${a.area === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');

  const modeFields = a.mode === 'near' ? `
    ${locationPanel(s)}
    <label>Within
      <select data-change="radius">
        ${[1, 2, 3, 5, 10, 25].map(r => `<option value="${r}" ${a.radius === r ? 'selected' : ''}>${r} km</option>`).join('')}
      </select>
    </label>` : `
    <div class="stack">
      <label>When
        <select data-change="day">
          <option value="tomorrow" ${a.day === 'tomorrow' ? 'selected' : ''}>Tomorrow</option>
          <option value="today" ${a.day === 'today' ? 'selected' : ''}>Today</option>
        </select>
      </label>
      <label>Area
        <select data-change="area">
          <option value="custom" ${custom ? 'selected' : ''}>Type an area…</option>
          ${areaOpts}
        </select>
      </label>
      ${custom ? `<label>Area name
        <input data-input="custom-area" value="${esc(a.customArea)}" placeholder="e.g. Da'an District, Taipei">
      </label>` : ''}
    </div>`;

  return `
    <h1>Ask AI</h1>
    <p class="muted small">Builds a question with your trip notes and guidebook places. Copy it, then paste into ChatGPT, Claude, Gemini or any AI you use.</p>
    <div class="seg">
      <button class="${a.mode === 'near' ? 'on' : ''}" data-action="mode" data-mode="near">Near me now</button>
      <button class="${a.mode === 'plan' ? 'on' : ''}" data-action="mode" data-mode="plan">Plan a day</button>
    </div>
    ${modeFields}
    <div class="stack" style="margin-top:12px">
      <label>Your question
        <textarea data-input="question" rows="3">${esc(questionText(s))}</textarea>
      </label>
      <label class="row" style="color:var(--text)">
        <input type="checkbox" data-change="include-log" ${a.includeLog ? 'checked' : ''} style="width:auto">
        Include my trip notes (${s.log.length})
      </label>
      <button class="btn primary" data-action="copy-prompt">Copy question</button>
      <div class="row small">
        <span class="muted">Then open:</span>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
        <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
        <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
      </div>
    </div>
    <h2>Preview</h2>
    <pre class="prompt" id="prompt-preview">${esc(buildAskPrompt(askContext(s)))}</pre>
  `;
}
