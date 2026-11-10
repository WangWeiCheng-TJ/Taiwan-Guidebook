// Entry point: routing, event dispatch, persistence, service worker.
// This is the only module that mutates `state` or writes storage.

import { state, places } from './state.js';
import { today } from './util.js';
import { writeJSON } from './storage.js';
import { loadGuidebook, placeById, cityCenter } from './data.js';
import { LOG_KEY, emptyDraft, draftDate, validateDraft, makeEntry, newId, removeEntry, mergeImport, exportPayload, notesFor,
  withLabels, trackedIds, goneFromGuide, guideUpdatedMessage } from './triplog.js';
import { buildPlacePrompt, defaultQuestion, areaLabel, buildExplainPrompt, buildPhotoPrompt } from './prompt.js';
import { TRIP_KEY, tripUrlFrom, loadTrip } from './trip.js';
import { planFromAiText } from './aiplan.js';
import { toast, announce, copyText, showBig, hideBig, flipBig, sayOnCard, wakeAgain, speak, openSheet, closeSheet } from './ui.js';
import { esc } from './util.js';
import { tr, trMsg, LANG_KEY, otherLang, localized } from './lang.js';
import { renderExplore } from './views/explore.js';
import { renderPlace, driverCard, driverSay } from './views/place.js';
import { renderLog } from './views/log.js';
import { renderAsk, currentPrompt, photoContext, renderLater, laterInfo } from './views/ask.js';
import { renderPhrases, renderTips, phraseCard, phraseCardFull, phraseSay } from './views/reference.js';
import { renderApps } from './views/apps.js';
import { renderLearn, timelinePrompt } from './views/learn.js';
import { PHRASE_GROUPS, phrasesIn } from './phrases.js';
import { PARTY_KEY, clampParty, withParty } from './party.js';
import { BACKUP_KEY, backupFileName, backupMark, bumpMark, backupExtras, planChoice } from './backup.js';
import { STAY_KEY, emptyStay, normalizeStay, validateStay, putStay, removeStay, staySay, stayCity } from './stay.js';
import { stayCard } from './views/stay.js';
import { cityName, placeName } from './views/common.js';
import { ASK_LATER_KEY, laterItem, addLater, removeLater, markCopied, waitingCount, laterLabel } from './asklater.js';
import { foodSheet, findPick, dishSheet, foodDriverCard, foodDriverSay, menuShop, menuPromptSheet } from './views/food.js';
import { foodFor } from './data.js';
import { parseRoute, activeTab, entryKey, withKey, scrollFor, entryOverlays, withOverlays, overlayChange, focusSelector } from './nav.js';

const view = document.getElementById('view');
let loadFailed = false; // the guidebook could not be loaded: #view shows loadFail
let renderedDay = ''; // today() when #view was last rendered: the log form's date and today's plan show it

/** A key unique enough to tell history entries and overlays apart, also across reloads. */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- Routing ----------
// #/explore | #/place/<id> | #/log | #/log/<placeId> (prefill) | #/ask | #/phrases | #/phrases/<group> | #/tips
// | #/apps | #/learn | #/learn/<topicId>. Unknown routes show Explore and say so in the address bar.

/**
 * Render the current route into #view and highlight the tab.
 * @param {boolean} [nav]  a route change: focus moves to `returnTo`, else to the new page's heading.
 *   Otherwise a control that had focus in #view gets it back in the new markup (a re-render would
 *   otherwise drop focus to <body>).
 * @param {{ selector: string, range: [number, number]|null, index: number }|null} [returnTo]  Back or Forward: the control
 *   that had focus when the reader left this page (focusedControl())
 */
function render(nav = false, returnTo = null) {
  if (activeTab(parseRoute(location.hash).tab) === 'ask') state.laterDot = false; // Ask later is on screen now
  renderChrome();
  if (!state.data) {
    if (loadFailed) view.innerHTML = `<p>${tr(state.lang, 'loadFail')}</p>`;
    return;
  }
  const { tab, arg, known } = parseRoute(location.hash);
  if (!known) history.replaceState(history.state, '', '#/explore');

  if (tab === 'log' && arg && placeById(places(), arg)) {
    state.draft = { ...state.draft, placeId: arg, name: '' };
    history.replaceState(history.state, '', '#/log');
  }

  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === activeTab(tab)));

  const views = {
    explore: () => renderExplore(state),
    place: () => renderPlace(state, arg),
    log: () => renderLog(state),
    ask: () => renderAsk(state),
    phrases: () => renderPhrases(state, arg),
    tips: () => renderTips(state),
    apps: () => renderApps(state),
    learn: () => renderLearn(state, arg),
  };
  const focus = nav ? returnTo : focusedControl();
  renderedDay = today();
  view.innerHTML = (views[tab] || views.explore)();
  if (focus) refocus(focus);
  else if (nav) focusHeading();
}

// ---------- Focus ----------

/**
 * The control focused inside #view, as a selector that finds it again after a re-render, and which of the
 * controls matching it (My trip can link to one place from the plan and from a note).
 * @returns {{ selector: string, range: [number, number]|null, index: number }|null}
 */
function focusedControl() {
  const el = document.activeElement;
  if (!el || el === view || !view.contains(el)) return null;
  const range = typeof el.selectionStart === 'number' ? [el.selectionStart, el.selectionEnd] : null;
  const selector = focusSelector(name => el.getAttribute(name));
  const index = selector ? Math.max(0, [...view.querySelectorAll(selector)].indexOf(el)) : 0;
  return { selector, range, index };
}

/**
 * Focus the control again (the same one of several that match, else the first), with its text selection; a
 * control that is now disabled (− at the minimum) hands focus to an enabled button next to it; one that is
 * gone hands it to the page heading.
 * @param {{ selector: string, range: [number, number]|null, index: number }} f
 */
function refocus(f) {
  let el = f.selector ? view.querySelectorAll(f.selector)[f.index] || view.querySelector(f.selector) : null;
  if (el?.disabled) el = el.parentElement?.querySelector('button:not([disabled])') || null;
  if (!el) return focusHeading();
  el.focus({ preventScroll: true });
  if (f.range && typeof el.selectionStart === 'number') el.setSelectionRange(f.range[0], f.range[1]);
}

/** The page's heading (#view when it has none), made focusable: focus goes there when nothing better is left. */
function heading() {
  const h = view.querySelector('h1') || view;
  h.setAttribute('tabindex', '-1');
  return h;
}

/** Move focus to the page's heading, so a screen reader starts reading the new page. */
function focusHeading() {
  heading().focus({ preventScroll: true });
}

// ---------- History: scroll position per entry, Back closes overlays first ----------

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; // restored per entry below
/** @type {Map<string, number>} scrollY by history entry key, saved when leaving the entry */
const scrolls = new Map();
/** @type {Map<string, { selector: string, range: [number, number]|null, index: number }>} the focused control, ditto */
const focused = new Map();
let entry = entryKey(history.state) || uid();
// A reload on an overlay's entry leaves nothing open: drop the stale overlay list, and step back off that
// entry onto the page's own (same URL; popstate finds nothing to close), so the first Back is not a dead press.
const staleOnLoad = entryOverlays(history.state).length > 0;
history.replaceState(withKey(withOverlays(history.state, []), entry), '');
if (staleOnLoad) history.back();

/** @type {{ kind: 'sheet'|'big', token: string, opener: Element|null }[]} open overlays, bottom first */
const overlays = [];
let backPending = false; // history.back() was called to close an overlay; popstate has not come yet

window.addEventListener('hashchange', () => {
  // #view still shows the page being left: remember where the reader was on it
  scrolls.set(entry, window.scrollY);
  const f = focusedControl();
  if (f) focused.set(entry, f); else focused.delete(entry);
  while (overlays.length) dropOverlay(false);
  const back = entryKey(history.state); // set: Back or Forward to a page seen before; null: a new page
  const y = scrollFor(back, scrolls);
  entry = back || uid();
  if (!back) history.replaceState(withKey(history.state, entry), '');
  render(true, back ? focused.get(back) || null : null);
  window.scrollTo(0, y);
});

/**
 * Record an overlay just opened (openSheet / showBig) with its own history entry, so Back closes it,
 * and move focus into it. A sheet opened over a sheet only replaces the content: same entry.
 * @param {'sheet'|'big'} kind
 * @param {Element|null} opener  the element focused before opening; gets focus back on close
 */
function pushOverlay(kind, opener) {
  if (overlays[overlays.length - 1]?.kind !== kind) {
    overlays.push({ kind, token: uid(), opener });
    history.pushState(withOverlays(history.state, overlays.map(o => o.token)), '');
  }
  syncInert();
  document.querySelector(kind === 'big' ? '#bigcard .close' : '#sheet .sheet-head button')?.focus({ preventScroll: true });
}

/**
 * @param {string} title
 * @param {string} html
 * @param {Element|null} [opener]  gets focus back when the sheet closes; by default the element focused now
 */
function sheet(title, html, opener = document.activeElement) {
  openSheet(title, html);
  pushOverlay('sheet', opener);
}

/**
 * @param {string} html
 * @param {string} [say]  the Chinese the card's 🔊 reads aloud
 */
function big(html, say = '') {
  const opener = document.activeElement;
  showBig(html, { say });
  pushOverlay('big', opener);
}

/**
 * Close the top overlay.
 * @param {boolean} restore  give focus back to the element that opened it
 */
function dropOverlay(restore) {
  const o = overlays.pop();
  if (!o) return;
  if (o.kind === 'big') hideBig(); else closeSheet();
  syncInert();
  if (restore && o.opener?.isConnected && o.opener.getClientRects().length) o.opener.focus({ preventScroll: true });
}

/** Close button, backdrop, Escape: step back off the overlay's entry (popstate closes it). */
function closeTop() {
  const top = overlays[overlays.length - 1];
  if (!top || backPending) return;
  if (entryOverlays(history.state).includes(top.token)) {
    backPending = true;
    history.back();
  } else {
    dropOverlay(true); // its entry is gone (replaced): just close it
  }
}

window.addEventListener('popstate', () => {
  backPending = false;
  const { close, stale } = overlayChange(overlays.map(o => o.token), entryOverlays(history.state));
  for (let i = 0; i < close; i++) dropOverlay(true);
  if (stale) {
    backPending = true;
    history.back();
  }
});

/** While an overlay is open, the page under it (and a sheet under the big card) takes no focus or clicks. */
function syncInert() {
  const kinds = overlays.map(o => o.kind);
  for (const el of [document.querySelector('.topbar'), view, document.querySelector('.tabbar')]) el?.toggleAttribute('inert', kinds.length > 0);
  document.getElementById('sheet').toggleAttribute('inert', kinds.includes('big') && kinds.includes('sheet'));
}

// ---------- State changes ----------

/**
 * Persist the log.
 * @returns {boolean} false when the device refused: the caller shows storageFail instead of its own message
 */
function saveLog() {
  return writeJSON(LOG_KEY, state.log);
}

/**
 * Entries logged before entries kept their place's name get it from `guide` (withLabels), so they keep a
 * name when a later guide drops the place. Stored when any changed; a refused write is not reported (the
 * labels are kept in memory and stored with the next save).
 * @param {import('./types.js').Place[]} guide
 */
function labelLog(guide) {
  const log = withLabels(state.log, guide);
  if (log === state.log) return;
  state.log = log;
  saveLog();
}

/**
 * Replace (or remove, with null) the current plan and persist it.
 * @param {import('./types.js').Trip|null} trip
 * @returns {boolean} false when the device refused to store it
 */
function setTrip(trip) {
  state.trip = trip;
  state.tripDate = null;
  state.pasteOpen = false;
  const ok = writeJSON(TRIP_KEY, trip);
  if (ok && trip) keepStorage();
  return ok;
}

let persistAsked = false; // keepStorage() asked the browser in this page session

/**
 * Ask the browser, once, to keep this site's storage when the device runs low on space: the notes and the plan
 * live only here. Called after the first saved note or plan; a browser without the API, or one that says no,
 * changes nothing (the backup line still says how old the last backup is).
 */
function keepStorage() {
  if (persistAsked) return;
  persistAsked = true;
  const st = navigator.storage;
  if (typeof st?.persist !== 'function') return;
  Promise.resolve(typeof st.persisted === 'function' ? st.persisted() : false)
    .then(kept => kept || st.persist())
    .catch(() => {});
}

/**
 * Count notes saved or imported since the last backup (bumpMark), for the line on My trip. Nothing to count
 * before the first backup: the line then counts every note. A refused write is not reported.
 * @param {number} n
 */
function notesAdded(n) {
  const mark = bumpMark(state.backup, n);
  if (mark === state.backup) return;
  state.backup = mark;
  writeJSON(BACKUP_KEY, mark);
}

/**
 * Change the party size (clamped), persist it and re-render: phrases and the Ask AI prompt follow it.
 * From now on the prompt names the party (partySet). Screen readers hear the new count: the re-render replaced
 * the count, and focus returns to the button, which says only "One person more".
 * @param {number} n
 */
function setParty(n) {
  state.party = clampParty(n);
  state.partySet = true;
  if (!writeJSON(PARTY_KEY, state.party)) toast(tr(state.lang, 'storageFail'));
  render();
  announce(tr(state.lang, 'party.now', { n: state.party }));
}

/**
 * A saved stay by id.
 * @param {string} id
 * @returns {import('./types.js').Stay|undefined}
 */
function stayById(id) {
  return state.stays.find(x => x.id === id);
}

/**
 * Save the My stay form: one stay per city, so a stay already saved for the same city is replaced, after
 * asking. Persisted on the device only (STAY_KEY); never in a prompt or the export.
 */
function saveStay() {
  const L = state.lang;
  const draft = normalizeStay(state.stayDraft);
  const error = validateStay(draft);
  if (error) return toast(trMsg(L, error));
  const stay = { ...draft, id: draft.id || newId() };
  const { stays, replaced } = putStay(state.stays, stay, places());
  if (replaced.length && !confirm(tr(L, 'stay.replaceConfirm', {
    city: cityName(stayCity(stay, places()), L), name: replaced.map(x => x.name).join('、') }))) return;
  state.stays = stays;
  state.stayDraft = emptyStay();
  state.stayOpen = false;
  toast(tr(L, writeJSON(STAY_KEY, stays) ? 'stay.saved' : 'storageFail'));
  render();
}

/**
 * A phrase by id, said for the current party size.
 * @param {string} id
 * @returns {import('./types.js').Phrase|undefined}
 */
function phraseById(id) {
  const ph = state.data.phrases.find(x => x.id === id);
  return ph && withParty(ph, state.party);
}

/** Load a plan shared as ?trip=<https url>, then drop the parameter so reloads don't refetch. */
async function loadSharedTrip() {
  const url = tripUrlFrom(location.search);
  if (!url) return;
  history.replaceState(history.state, '', location.pathname + location.hash);
  const { trip, errors } = await loadTrip(url);
  if (trip) {
    toast(setTrip(trip) ? tr(state.lang, 'planLoaded', { t: trip.title }) : tr(state.lang, 'storageFail'));
    render();
  } else {
    toast(trMsg(state.lang, errors[0]));
  }
}

function locateMe() {
  if (!('geolocation' in navigator)) return toast(tr(state.lang, 'noGeo'));
  toast(tr(state.lang, 'locating'));
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.pos = { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps', label: 'your location' };
      render();
    },
    () => toast(tr(state.lang, 'geoFail')),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
  );
}

function pickLocation(city) {
  const center = cityCenter(places(), city);
  if (!center) return;
  state.pos = { ...center, source: 'pick', label: city, city };
  state.exploreCity = city;
  render();
}

// ---------- Ask later: every copied prompt, kept on the device ----------

/** The browser says it has no connection. */
const isOffline = () => navigator.onLine === false;

/**
 * The message after a copy. Offline, a copy that worked says the question stays in Ask later.
 * @param {boolean} ok    copyText's result
 * @param {string} key    the usual message
 * @param {string} fail   the message when copying failed
 * @returns {string}
 */
function copiedMsg(ok, key, fail) {
  return tr(state.lang, !ok ? fail : isOffline() ? 'later.keptOffline' : key);
}

/**
 * Keep a prompt the app just copied in Ask later (addLater: newest first, at most ASK_LATER_MAX, the same prompt
 * once), flagged waiting when the browser is offline. Also kept when copying failed: the list can copy it again.
 * Device only, never in the export. A refused write is not reported: the copy itself worked, and the list is kept
 * for this page session.
 * @param {{ kind: import('./asklater.js').AskLaterKind, subject: string, where: string }} info
 * @param {string} prompt
 */
function remember(info, prompt) {
  state.later = addLater(state.later, laterItem({ id: newId(), at: new Date(), ...info, prompt, offline: isOffline() }));
  writeJSON(ASK_LATER_KEY, state.later);
  refreshLater();
}

/**
 * Store a changed Ask later list and draw it again with the tab's dot.
 * @param {import('./asklater.js').AskLaterItem[]} list
 * @returns {boolean} false when the device refused to store it
 */
function setLater(list) {
  state.later = list;
  if (!list.length) state.laterAll = false;
  const ok = writeJSON(ASK_LATER_KEY, list);
  refreshLater();
  renderChrome();
  return ok;
}

/**
 * Draw Ask later again on its own (#ask-later, on the Ask AI tab), not the whole tab: an open Preview stays open
 * and focus returns to the control that had it. Elsewhere there is nothing to draw.
 */
function refreshLater() {
  const el = document.getElementById('ask-later');
  if (!el) return;
  const f = focusedControl();
  el.innerHTML = renderLater(state);
  if (f) refocus(f);
}

/**
 * Items copied offline wait in Ask later: the Ask AI tab gets a dot until it is shown (none while it is on screen).
 * The caller draws the tab bar.
 * @returns {number} how many items wait
 */
function flagLater() {
  const n = waitingCount(state.later);
  if (n) state.laterDot = activeTab(parseRoute(location.hash).tab) !== 'ask';
  return n;
}

/**
 * The browser is back online with items copied offline: a toast says how many, and the Ask AI tab gets a dot
 * until it is shown (on the Ask AI tab itself, only the toast). An app opened online gets the dot at start
 * (init), without the toast.
 */
function laterOnline() {
  const n = flagLater();
  if (!n) return;
  renderChrome();
  toast(tr(state.lang, n === 1 ? 'later.online1' : 'later.onlineN', { n }), 6000);
}

function refreshPreview() {
  const el = document.getElementById('prompt-preview');
  if (el) el.textContent = currentPrompt(state);
}

/** Keep the suggested question in sync with area/day until the user edits it. */
function refreshQuestion() {
  if (state.ask.question === null) {
    const q = view.querySelector('[data-input="question"]');
    const a = state.ask;
    if (q) q.value = defaultQuestion(a.mode, a.day, areaLabel(a.area, a.customArea), state.lang);
  }
  refreshPreview();
}

/**
 * Read a chosen backup file in: its notes are merged into the log (mergeImport: version 1, version 2 or a bare
 * array). Its plan (version 2) is loaded when the phone has none, and replaces a different plan only after
 * asking. Its party size is taken when the traveller never set one on this phone.
 * @param {HTMLInputElement} input  the file input; emptied afterwards, so the same file can be chosen again
 */
async function importLog(input) {
  const file = input.files?.[0];
  if (!file) return;
  let parsed, merged;
  try {
    parsed = JSON.parse(await file.text());
    merged = mergeImport(state.log, parsed);
  } catch {
    merged = null;
  }
  input.value = '';
  const L = state.lang;
  if (!merged) return toast(tr(L, 'badImport'));
  state.log = merged.log;
  let ok = saveLog();
  if (ok && merged.added) keepStorage();
  notesAdded(merged.added);
  const said = [tr(L, 'imported', { n: merged.added })];

  const { trip, party, badTrip } = backupExtras(parsed);
  const choice = planChoice(state.trip, trip);
  if (choice === 'load' || (choice === 'ask' && confirm(tr(L, 'backup.planConfirm', { t: trip.title, old: state.trip.title })))) {
    ok = setTrip(trip) && ok;
    said.push(tr(L, 'planLoaded', { t: trip.title }));
  }
  if (badTrip) said.push(tr(L, 'backup.badPlan'));
  if (party !== null && !state.partySet) {
    state.party = party;
    state.partySet = true;
    ok = writeJSON(PARTY_KEY, party) && ok;
  }
  toast(ok ? said.join(' ') : tr(L, 'storageFail'), said.length > 1 ? 6000 : undefined);
  render();
}

/**
 * Export the backup (exportPayload version 2: notes, plan, party size; never My stay). Where the browser can
 * share the file, the share sheet sends it to the traveller's own chat or mail; elsewhere it downloads. A
 * cancelled share is no backup; a share that fails otherwise falls back to the download. Afterwards the
 * mark (BACKUP_KEY) records the backup, for the line on My trip.
 */
async function exportLog() {
  const L = state.lang;
  const payload = exportPayload(state.log, new Date(), { trip: state.trip, party: state.partySet ? state.party : null });
  const json = JSON.stringify(payload, null, 2);
  const name = backupFileName(today());
  const file = typeof File === 'function' ? new File([json], name, { type: 'application/json' }) : null;
  if (file && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: tr(L, 'backup.shareTitle', { d: today() }) });
    } catch (err) {
      if (err?.name === 'AbortError') return; // the traveller closed the share sheet
      download(json, name);
    }
  } else {
    download(json, name); // no await before this: the click still counts as the user's
  }
  state.backup = backupMark(new Date());
  writeJSON(BACKUP_KEY, state.backup);
  render();
}

/**
 * Save text as a file through a temporary link.
 * @param {string} json
 * @param {string} name
 */
function download(json, name) {
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Event dispatch (views declare data-action / data-change / data-input) ----------

const actions = {
  locate: () => locateMe(),
  'clear-location': () => { state.pos = null; render(); },
  'phrase-sheet': el => {
    const ph = phraseById(el.dataset.id);
    const g = ph && PHRASE_GROUPS.find(x => x.id === ph.category);
    if (ph) sheet(g ? `${g.icon} ${tr(state.lang, `cat.${g.id}`)}` : '', phraseCardFull(ph, state.lang));
  },
  'phrases-sheet': el => {
    const g = PHRASE_GROUPS.find(x => x.id === el.dataset.group);
    if (!g) return;
    sheet(`${g.icon} ${tr(state.lang, `cat.${g.id}`)}`, phrasesIn(state.data.phrases, g.id).map(ph => phraseCardFull(withParty(ph, state.party), state.lang)).join(''));
  },
  'close-sheet': () => closeTop(),
  'close-big': () => closeTop(),
  // The big card's 🔊 (a quick second tap reads it again slowly) and rotate-180° toggle: the card stays open.
  'big-say': el => {
    if (typeof speechSynthesis === 'undefined') return toast(tr(state.lang, 'noSpeech'));
    sayOnCard(el.dataset.say);
  },
  'big-flip': el => el.setAttribute('aria-pressed', String(flipBig())),
  'food-sheet': el => {
    const f = findPick(state.data.food, el.dataset.city, el.dataset.id);
    if (f) sheet(tr(state.lang, 'foodPick'), foodSheet(f.city, f.pick, state.lang));
  },
  'dish-sheet': el => {
    const c = foodFor(state.data.food, el.dataset.city);
    const d = c && (c.to_try || []).find(x => x.id === el.dataset.id);
    if (d) sheet(tr(state.lang, 'foodPick'), dishSheet(c, d, state.lang));
  },
  // A food sheet's "Ask AI about the menu": copy a menu prompt for that pick or dish, then show the steps.
  'ask-menu': async el => {
    const shop = menuShop(state.data.food, el.dataset.city, el.dataset.id, el.dataset.kind);
    if (!shop) return;
    const L = state.lang;
    const prompt = buildPhotoPrompt(photoContext(state, shop), 'menu', L);
    const ok = await copyText(prompt);
    remember({ kind: 'menu', subject: shop.name || localized(shop, 'dish', L), where: L === 'zh_TW' ? shop.city_zh : shop.city_en }, prompt);
    toast(copiedMsg(ok, 'copied', 'copyFailPreview'));
    sheet(tr(state.lang, 'askMenu'), menuPromptSheet(prompt, ok, state.lang));
  },
  'food-driver': el => {
    const f = findPick(state.data.food, el.dataset.city, el.dataset.id);
    if (f) big(foodDriverCard(f.city, f.pick), foodDriverSay(f.city, f.pick));
  },
  city: el => { state.exploreCity = el.dataset.city; render(); },
  driver: el => {
    const p = placeById(places(), el.dataset.id);
    if (p) big(driverCard(p), driverSay(p));
  },
  'show-phrase': el => {
    const ph = phraseById(el.dataset.id);
    if (ph) big(phraseCard(ph), phraseSay(ph));
  },
  say: el => {
    if (typeof speechSynthesis === 'undefined') return toast(tr(state.lang, 'noSpeech'));
    speak(el.dataset.say || el.textContent.trim());
  },
  speak: el => {
    const ph = phraseById(el.dataset.id);
    if (ph) speak(phraseSay(ph)); // its tts respelling when the voice engine mispronounces it
  },
  'party-dec': () => setParty(state.party - 1),
  'party-inc': () => setParty(state.party + 1),
  'copy-place': async el => {
    const p = placeById(places(), el.dataset.id);
    if (!p) return;
    const prompt = buildPlacePrompt(p, notesFor(state.log, p.id));
    const ok = await copyText(prompt);
    remember({ kind: 'place', subject: placeName(p, state.lang), where: localized(p.location, 'city', state.lang) }, prompt);
    toast(copiedMsg(ok, 'copiedPlace', 'copyFail'));
  },
  // Copy for AI on the timeline page: the timeline of all places and a request for the story that connects them.
  // Kept in Ask later as "About Taiwan through the places".
  'copy-timeline': async () => {
    const prompt = timelinePrompt(state);
    const ok = await copyText(prompt);
    remember({ kind: 'place', subject: tr(state.lang, 'timeline.title'), where: '' }, prompt);
    toast(copiedMsg(ok, 'copied', 'copyFail'));
  },
  star: el => {
    const n = Number(el.dataset.n);
    state.draft.stars = state.draft.stars === n ? 0 : n;
    view.querySelectorAll('.stars button').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.n) <= state.draft.stars);
      b.setAttribute('aria-pressed', String(Number(b.dataset.n) === state.draft.stars));
    });
  },
  'delete-entry': el => {
    if (!confirm(tr(state.lang, 'deleteNote'))) return;
    state.log = removeEntry(state.log, el.dataset.id);
    if (!saveLog()) toast(tr(state.lang, 'storageFail'));
    render();
  },
  export: () => exportLog(),
  // The file input itself is hidden; this button is what keyboard and switch users reach.
  import: () => view.querySelector('[data-change="import"]')?.click(),
  mode: el => { state.ask.mode = el.dataset.mode; render(); },
  'paste-plan': () => {
    const box = view.querySelector('[data-input="ai-answer"]');
    if (box) state.pasteText = box.value;
    const { trip, errors } = planFromAiText(state.pasteText, places());
    if (!trip) return toast(trMsg(state.lang, errors[0]));
    state.pasteText = '';
    toast(setTrip(trip) ? tr(state.lang, 'planLoaded', { t: trip.title }) : tr(state.lang, 'storageFail'));
    render();
  },
  'paste-plan-again': () => { state.pasteOpen = true; render(); },
  'cancel-paste': () => { state.pasteOpen = false; render(); },
  'clear-trip': () => {
    if (!confirm(tr(state.lang, 'removePlanConfirm'))) return;
    if (!setTrip(null)) toast(tr(state.lang, 'storageFail'));
    render();
  },
  'trip-day': el => { state.tripDate = el.dataset.date; render(); },
  // My stay: "Take me back" shows the stay in the driver card's layout, with its phone as a tel: link.
  'stay-card': el => {
    const st = stayById(el.dataset.id);
    if (st) big(stayCard(st), staySay(st));
  },
  'stay-add': () => { state.stayDraft = emptyStay(); state.stayOpen = true; render(); },
  'stay-edit': el => {
    const st = stayById(el.dataset.id);
    if (!st) return;
    state.stayDraft = { ...st };
    state.stayOpen = true;
    render();
  },
  'stay-cancel': () => { state.stayDraft = emptyStay(); state.stayOpen = false; render(); },
  'stay-remove': el => {
    if (!stayById(el.dataset.id) || !confirm(tr(state.lang, 'stay.removeConfirm'))) return;
    state.stays = removeStay(state.stays, el.dataset.id);
    if (state.stayDraft.id === el.dataset.id) { state.stayDraft = emptyStay(); state.stayOpen = false; }
    if (!writeJSON(STAY_KEY, state.stays)) toast(tr(state.lang, 'storageFail'));
    render();
  },
  'copy-prompt': async () => {
    const prompt = currentPrompt(state);
    const info = laterInfo(state);
    const ok = await copyText(prompt);
    remember(info, prompt);
    toast(copiedMsg(ok, info.kind === 'photo' ? 'photoCopied' : 'copied', 'copyFailPreview'));
  },
  // Ask later. Copy: an item copied again while online stops waiting (markCopied); a failed copy shows the
  // prompt in a sheet, to select by hand.
  'later-copy': async el => {
    const item = state.later.find(x => x.id === el.dataset.id);
    if (!item) return;
    const L = state.lang;
    const ok = await copyText(item.prompt);
    if (!ok) {
      return sheet(laterLabel(item, L), `<p class="small muted">${tr(L, 'copyFailPreview')}</p><pre class="prompt">${esc(item.prompt)}</pre>`, el);
    }
    toast(copiedMsg(ok, item.kind === 'photo' || item.kind === 'menu' ? 'photoCopied' : 'copied', 'copyFailPreview'));
    if (!isOffline()) {
      const list = markCopied(state.later, item.id);
      if (list !== state.later && !setLater(list)) toast(tr(L, 'storageFail'));
    }
  },
  'later-delete': el => {
    const list = removeLater(state.later, el.dataset.id);
    if (list === state.later) return;
    if (setLater(list)) announce(tr(state.lang, 'later.removed'));
    else toast(tr(state.lang, 'storageFail'));
  },
  'later-clear': () => {
    if (!state.later.length || !confirm(tr(state.lang, 'later.clearConfirm'))) return;
    toast(tr(state.lang, setLater([]) ? 'later.cleared' : 'storageFail'));
  },
  'later-all': () => { state.laterAll = !state.laterAll; refreshLater(); },
};

function dispatchClick(e) {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) {
    e.preventDefault();
    actions[el.dataset.action](el);
  }
}
view.addEventListener('click', dispatchClick);
document.getElementById('sheet').addEventListener('click', dispatchClick);
// Keyboard users: Enter or Space on a role=button element (tappable characters) acts like a click.
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-action]')) {
    e.preventDefault();
    e.target.click();
    return;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeTop();
});

// The big card closes on a tap on its backdrop (#bigcard itself, around the panel), never on its text:
// a driver pointing at the address must not close it. Its buttons dispatch like the page's.
const bigcard = document.getElementById('bigcard');
bigcard.addEventListener('click', e => {
  if (e.target === bigcard) closeTop();
  else dispatchClick(e);
});
// The browser drops the screen wake lock while the page is hidden; take it again if the big card is open.
// Back after midnight: render again, so the log form and today's plan show the new day.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') return;
  wakeAgain();
  if (state.data && renderedDay && today() !== renderedDay) render();
});

// A place photo comes from Wikimedia, which the service worker does not cache: when it fails (offline),
// hide it together with its credit line. 'error' does not bubble, hence the capture phase.
view.addEventListener('error', e => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.classList.contains('photo')) img.closest('figure')?.setAttribute('hidden', '');
}, true);

// Language switch in the top bar: visible on every screen.
document.getElementById('lang-toggle').addEventListener('click', () => {
  state.lang = otherLang(state.lang);
  writeJSON(LANG_KEY, state.lang);
  if (state.ask.question === null) refreshQuestion();
  render();
});

/** Top bar, tab bar (its labels and landmark name), the page title and <html lang> in the current language (they live outside #view). */
function renderChrome() {
  const L = state.lang;
  document.documentElement.lang = L === 'zh_TW' ? 'zh-Hant-TW' : 'en';
  document.title = tr(L, 'brand');
  document.querySelector('.tabbar')?.setAttribute('aria-label', tr(L, 'navLabel'));
  document.getElementById('brand').textContent = tr(L, 'brand');
  document.getElementById('net-status').textContent = tr(L, 'offline');
  const toggle = document.getElementById('lang-toggle');
  toggle.textContent = tr(L, 'switchTo');
  toggle.setAttribute('aria-label', tr(L, 'switchLabel'));
  // Ask AI's dot: online with items copied offline (laterOnline, or at start), until the tab is shown
  const waiting = waitingCount(state.later);
  const dot = state.laterDot && waiting > 0;
  document.querySelectorAll('.tabbar a').forEach(a => {
    const label = tr(L, `tab.${a.dataset.tab}`);
    a.querySelector('[data-label]').textContent = label;
    if (a.dataset.tab !== 'ask') return;
    a.classList.toggle('has-dot', dot);
    if (dot) a.setAttribute('aria-label', tr(L, 'later.tabWaiting', { tab: label, n: waiting }));
    else a.removeAttribute('aria-label');
  });
}

view.addEventListener('change', async e => {
  const el = e.target;
  switch (el.dataset.change) {
    case 'pick-location': pickLocation(el.value); break;
    case 'radius': state.ask.radius = Number(el.value); refreshPreview(); break;
    case 'day': state.ask.day = el.value; refreshQuestion(); break;
    case 'area': state.ask.area = el.value; render(); break;
    case 'include-log': state.ask.includeLog = el.checked; refreshPreview(); break;
    case 'want-plan': state.ask.wantPlan = el.checked; refreshPreview(); break;
    case 'photo-kind': state.ask.photo = el.value; refreshPreview(); break; // a radio: no re-render, focus stays
    case 'import': await importLog(el); break;
  }
  if (el.form?.dataset.form === 'log' && el.name) {
    setDraftField(el);
    if (el.name === 'placeId') view.querySelector('[data-other]').hidden = !!el.value;
  }
  if (el.form?.dataset.form === 'stay' && el.name) state.stayDraft[el.name] = el.value;
});

/**
 * Copy one log form field into the draft. The date is kept as "" while it is today's (draftDate),
 * so the form shows the new day when it is drawn again after midnight (also when the page comes back
 * into view on a new day); a save before that keeps the date the form shows.
 * @param {HTMLInputElement} el
 */
function setDraftField(el) {
  state.draft[el.name] = el.name === 'date' ? draftDate(el.value, today()) : el.value;
}

view.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.input === 'question') { state.ask.question = el.value; refreshPreview(); }
  if (el.dataset.input === 'custom-area') { state.ask.customArea = el.value; refreshQuestion(); }
  if (el.dataset.input === 'photo-note') { state.ask.photoNote = el.value; refreshPreview(); }
  if (el.dataset.input === 'ai-answer') state.pasteText = el.value; // kept across re-renders until a plan loads
  if (el.form?.dataset.form === 'log' && el.name) setDraftField(el);
  if (el.form?.dataset.form === 'stay' && el.name) state.stayDraft[el.name] = el.value;
});

view.addEventListener('submit', e => {
  if (e.target.dataset.form === 'stay') {
    e.preventDefault();
    return saveStay();
  }
  if (e.target.dataset.form !== 'log') return;
  e.preventDefault();
  const error = validateDraft(state.draft);
  if (error) return toast(trMsg(state.lang, error));
  // A draft that follows today ("") is saved under the date its form shows: the form may have been drawn
  // before midnight, and the note must land on the day the traveler saw
  const shown = e.target.elements?.date?.value;
  state.log = [...state.log, makeEntry(state.draft, newId(), shown || today(), places())];
  state.draft = emptyDraft(state.draft.date);
  const ok = saveLog();
  if (ok) keepStorage();
  notesAdded(1);
  toast(tr(state.lang, ok ? 'saved' : 'storageFail'));
  render();
});

// ---------- Select text, ask AI what it means ----------
// Mobile browsers don't let a page add items to the native selection menu, so a separate
// button floats above the tab bar while text inside the app is selected.

const askbar = document.getElementById('askbar');
let selection = null; // { text, context, source, anchor }, kept because tapping the button may clear the selection

function sourceOf() {
  const { tab, arg } = parseRoute(location.hash);
  const p = tab === 'place' && placeById(places(), arg);
  return p ? p.name.en : document.querySelector('#view h1')?.textContent?.trim() || '';
}

let selTimer;
document.addEventListener('selectionchange', () => {
  clearTimeout(selTimer);
  selTimer = setTimeout(() => {
    const sel = document.getSelection();
    const text = sel ? sel.toString().trim() : '';
    const node = sel && sel.anchorNode;
    const inApp = node && (view.contains(node) || document.getElementById('sheet').contains(node));
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    // My stay (data-private) never goes into a prompt: not selected, not as the text around a selection, and
    // not as part of a selection that starts elsewhere and runs into it
    const touchesPrivate = el?.closest('[data-private]')
      || [...document.querySelectorAll('[data-private]')].some(p => sel?.containsNode?.(p, true));
    if (!text || !inApp || text.length > 200 || touchesPrivate) { askbar.hidden = true; return; }
    const block = el?.closest('p, li, summary, .card, details, .zc, h1, h2') || node.parentElement;
    selection = { text, context: block ? block.textContent : '', source: sourceOf(), anchor: el };
    const short = text.length > 16 ? text.slice(0, 15) + '…' : text;
    askbar.textContent = tr(state.lang, 'askAbout', { t: short });
    askbar.hidden = false;
  }, 250);
});

askbar.addEventListener('click', async () => {
  if (!selection) return;
  const { text, context, source, anchor } = selection;
  const prompt = buildExplainPrompt({ text, context, source, lang: state.lang });
  const ok = await copyText(prompt);
  remember({ kind: 'explain', subject: text, where: source }, prompt);
  // The bar hides itself, so it cannot take focus back when the sheet closes: a control around the selected
  // text does, else the page's heading
  const near = anchor?.closest?.('a[href], button, input, select, textarea, summary, [tabindex]');
  const opener = near && view.contains(near) ? near : heading();
  askbar.hidden = true;
  document.getSelection()?.removeAllRanges();
  sheet(tr(state.lang, 'explainTitle'), `
    <p class="small ${ok ? '' : 'muted'}">${copiedMsg(ok, 'explainCopied', 'copyFailPreview')}</p>
    <div class="row small" style="margin-bottom:10px">
      <span class="muted">${tr(state.lang, 'thenOpen')}</span>
      <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
      <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
      <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
    </div>
    <pre class="prompt">${esc(prompt)}</pre>`, opener);
});

// ---------- Online status, data, service worker ----------

function updateNet() {
  document.getElementById('net-status').hidden = navigator.onLine;
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
window.addEventListener('online', laterOnline);

/** #view shows the app (a page, or loadFail): the boot watchdog in index.html stands down. */
const markStarted = () => view.setAttribute('data-started', '');

async function init() {
  updateNet();
  if (!isOffline()) flagLater(); // opened online with items copied offline still waiting: the dot, no toast
  renderChrome(); // top bar and tabs in the saved or browser language while the guide loads
  // data-loading: the boot watchdog in index.html looks for it (and replaces it if the app never gets further)
  view.innerHTML = `<p class="muted" data-loading>${tr(state.lang, 'loading')}</p>`;
  try {
    state.data = await loadGuidebook();
  } catch {
    loadFailed = true; // render() shows loadFail, in the language the toggle picks
    render();
    markStarted();
    return;
  }
  labelLog(places());
  render();
  markStarted();
  await loadSharedTrip();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // sw.js posts this after a background refresh brought a different guidebook.json. Log entries take their
  // names from the guide being replaced; the toast names the logged or planned places the new one dropped.
  navigator.serviceWorker.addEventListener('message', async e => {
    if (e.data?.type !== 'data-updated') return;
    const before = places();
    try {
      state.data = await loadGuidebook();
    } catch {
      return; // keep the current data
    }
    labelLog(before);
    render();
    const gone = goneFromGuide(trackedIds(state.log, state.trip), before, places(), state.lang);
    toast(guideUpdatedMessage(gone, state.lang), gone.length ? 6000 : undefined);
  });
}

init();
