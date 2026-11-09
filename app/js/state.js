// The single mutable app state. Only main.js mutates it; views read it.

import { readJSON } from './storage.js';
import { LOG_KEY, emptyDraft } from './triplog.js';
import { TRIP_KEY, parseTrip } from './trip.js';
import { LANG_KEY, initialLang } from './lang.js';
import { PARTY_KEY, clampParty, partyChosen } from './party.js';
import { STAY_KEY, readStays, emptyStay } from './stay.js';
import { BACKUP_KEY, readMark } from './backup.js';
import { ASK_LATER_KEY, readLater } from './asklater.js';

/** @typedef {import('./types.js').Guidebook} Guidebook */
/** @typedef {import('./types.js').Pos} Pos */
/** @typedef {import('./types.js').LogEntry} LogEntry */
/** @typedef {import('./types.js').LogDraft} LogDraft */

/**
 * @typedef {Object} AppState
 * @property {import('./lang.js').Lang} lang  UI and content language, persisted under LANG_KEY
 * @property {Guidebook|null} data   null until loaded
 * @property {Pos|null} pos          not persisted: location is re-acquired each session
 * @property {LogEntry[]} log        persisted under LOG_KEY
 * @property {import('./types.js').Trip|null} trip  persisted under TRIP_KEY
 * @property {number} party        people traveling together, PARTY_MIN..PARTY_MAX; persisted under PARTY_KEY
 * @property {boolean} partySet     the traveler has set party (it is in storage); until then phrases use the
 *                                  default 2 and the Ask AI prompt leaves the party out
 * @property {boolean} pasteOpen     My trip: show the "paste AI answer" box even when a plan exists
 * @property {string} pasteText      My trip: what is in the "paste AI answer" box (survives re-renders; cleared
 *                                   once a plan loads from it)
 * @property {string|null} tripDate  My trip: the plan day the user picked; null = defaultTripDate()
 * @property {import('./types.js').Stay[]} stays  My stay: where the traveler sleeps, persisted under STAY_KEY (device only:
 *                                  never in a prompt or the export)
 * @property {import('./types.js').Stay} stayDraft  My stay form (survives re-renders; id set when editing a saved stay)
 * @property {boolean} stayOpen     My trip: show the My stay form even when a stay is saved
 * @property {import('./backup.js').BackupMark|null} backup  the last backup and the notes added since, persisted
 *                                  under BACKUP_KEY; null = never backed up on this device
 * @property {import('./asklater.js').AskLaterItem[]} later  Ask later: every prompt the app copied, newest first, at
 *                                  most ASK_LATER_MAX; persisted under ASK_LATER_KEY (device only: never in the export)
 * @property {boolean} laterAll     Ask AI: the Ask later list shows every item, not only the newest (not persisted)
 * @property {boolean} laterDot     the Ask AI tab shows a dot: the browser came back online with items copied
 *                                  offline; cleared when the Ask AI tab is shown (not persisted)
 * @property {string} exploreCity    "all" or a city_en
 * @property {LogDraft} draft        the log form, survives tab switches; draft.date "" follows today's date
 * @property {{ mode: 'near'|'plan'|'photo', radius: number, area: string, customArea: string,
 *              day: 'today'|'tomorrow', question: string|null, includeLog: boolean, wantPlan: boolean,
 *              photo: import('./prompt.js').PhotoKind, photoNote: string }} ask
 *           question null = not edited, follow defaultQuestion(); photo / photoNote: the "About a photo" mode's
 *           preset (PHOTO_KINDS) and the traveler's addition to its prompt (not persisted)
 */

const storedParty = readJSON(PARTY_KEY, null);

/** @type {AppState} */
export const state = {
  lang: initialLang(readJSON(LANG_KEY, null), typeof navigator === 'undefined' ? '' : navigator.language),
  data: null,
  pos: null,
  log: readJSON(LOG_KEY, []),
  trip: parseTrip(readJSON(TRIP_KEY, null)).trip, // re-validated: storage may hold an old or damaged plan
  party: clampParty(storedParty),
  partySet: partyChosen(storedParty),
  pasteOpen: false,
  pasteText: '',
  tripDate: null,
  stays: readStays(readJSON(STAY_KEY, [])), // re-validated, like the plan
  stayDraft: emptyStay(),
  stayOpen: false,
  backup: readMark(readJSON(BACKUP_KEY, null)), // re-validated, like the plan
  later: readLater(readJSON(ASK_LATER_KEY, [])), // re-validated, like the plan
  laterAll: false,
  laterDot: false,
  exploreCity: 'all',
  draft: emptyDraft(''), // not today(): an app left open past midnight would log under yesterday
  ask: { mode: 'near', radius: 3, area: '', customArea: '', day: 'tomorrow', question: null, includeLog: true, wantPlan: false,
    photo: 'menu', photoNote: '' },
};

/**
 * Places in the loaded guidebook ([] before load).
 * @returns {import('./types.js').Place[]}
 */
export function places() {
  return state.data ? state.data.places : [];
}
