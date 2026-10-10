// The single mutable app state. Only main.js mutates it; views read it.

import { readJSON } from './storage.js';
import { today } from './util.js';
import { LOG_KEY, emptyDraft } from './triplog.js';
import { TRIP_KEY, parseTrip } from './trip.js';

/** @typedef {import('./types.js').Guidebook} Guidebook */
/** @typedef {import('./types.js').Pos} Pos */
/** @typedef {import('./types.js').LogEntry} LogEntry */
/** @typedef {import('./types.js').LogDraft} LogDraft */

/**
 * @typedef {Object} AppState
 * @property {Guidebook|null} data   null until loaded
 * @property {Pos|null} pos          not persisted: location is re-acquired each session
 * @property {LogEntry[]} log        persisted under LOG_KEY
 * @property {import('./types.js').Trip|null} trip  persisted under TRIP_KEY
 * @property {boolean} pasteOpen     My trip: show the "paste AI answer" box even when a plan exists
 * @property {string|null} tripDate  My trip: the plan day the user picked; null = defaultTripDate()
 * @property {string} exploreCity    "all" or a city_en
 * @property {LogDraft} draft        the log form, survives tab switches
 * @property {{ mode: 'near'|'plan', radius: number, area: string, customArea: string,
 *              day: 'today'|'tomorrow', question: string|null, includeLog: boolean, wantPlan: boolean }} ask
 *           question null = not edited, follow defaultQuestion()
 */

/** @type {AppState} */
export const state = {
  data: null,
  pos: null,
  log: readJSON(LOG_KEY, []),
  trip: parseTrip(readJSON(TRIP_KEY, null)).trip, // re-validated: storage may hold an old or damaged plan
  pasteOpen: false,
  tripDate: null,
  exploreCity: 'all',
  draft: emptyDraft(today()),
  ask: { mode: 'near', radius: 3, area: '', customArea: '', day: 'tomorrow', question: null, includeLog: true, wantPlan: false },
};

/**
 * Places in the loaded guidebook ([] before load).
 * @returns {import('./types.js').Place[]}
 */
export function places() {
  return state.data ? state.data.places : [];
}
