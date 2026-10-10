// Fragments shared by several views. View contract: (state) => HTML string, no side effects.
// Interactive elements declare intent with data-action (click) / data-change / data-input,
// which main.js dispatches. Views never attach listeners themselves.

import { esc } from '../util.js';
import { places } from '../state.js';

/**
 * "Distances from X [Update]" when a position is set,
 * otherwise "Use my location" plus a place picker as fallback.
 * Emits: data-action="locate", data-change="pick-location" (value = place id).
 * @param {import('../state.js').AppState} s
 * @returns {string}
 */
export function locationPanel(s) {
  if (s.pos) {
    return `<div class="panel row spread small">
      <span>Distances from <b>${esc(s.pos.label)}</b></span>
      <button class="btn small" data-action="locate">Update</button>
    </div>`;
  }
  const options = places().map(p => `<option value="${esc(p.id)}">${esc(p.name.en)}</option>`).join('');
  return `<div class="panel stack small">
    <button class="btn primary" data-action="locate">⌖ Use my location</button>
    <label>or I'm near…
      <select data-change="pick-location"><option value="">Choose a place</option>${options}</select>
    </label>
  </div>`;
}
