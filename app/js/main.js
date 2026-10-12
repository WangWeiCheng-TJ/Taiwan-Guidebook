// Entry point: routing, event dispatch, persistence, service worker.
// This is the only module that mutates `state` or writes storage.

import { state, places } from './state.js';
import { today } from './util.js';
import { writeJSON } from './storage.js';
import { loadGuidebook, placeById, cityCenter } from './data.js';
import { LOG_KEY, emptyDraft, validateDraft, makeEntry, newId, removeEntry, mergeImport, exportPayload, notesFor } from './triplog.js';
import { buildAskPrompt, buildPlacePrompt, defaultQuestion, areaLabel, buildExplainPrompt } from './prompt.js';
import { TRIP_KEY, tripUrlFrom, loadTrip } from './trip.js';
import { planFromAiText } from './aiplan.js';
import { toast, copyText, showBig, hideBig, speak, openSheet, closeSheet } from './ui.js';
import { esc } from './util.js';
import { tr, trMsg, LANG_KEY, otherLang } from './lang.js';
import { renderExplore } from './views/explore.js';
import { renderPlace, driverCard } from './views/place.js';
import { renderLog } from './views/log.js';
import { renderAsk, askContext } from './views/ask.js';
import { renderPhrases, renderTips, phraseCard, phraseCardFull } from './views/reference.js';
import { PHRASE_GROUPS, phrasesIn } from './phrases.js';
import { foodSheet, findPick, dishSheet } from './views/food.js';
import { foodFor } from './data.js';

const view = document.getElementById('view');

// ---------- Routing ----------
// #/explore | #/place/<id> | #/log | #/log/<placeId> (prefill) | #/ask | #/phrases | #/phrases/<group> | #/tips

/**
 * @param {string} hash  location.hash
 * @returns {{ tab: string, arg: string }}
 */
function parseRoute(hash) {
  const [route, arg = ''] = hash.replace(/^#\/?/, '').split('/');
  return { tab: route || 'explore', arg: decodeURIComponent(arg) };
}

/** Render the current route into #view and highlight the tab. */
function render() {
  if (!state.data) return;
  const { tab, arg } = parseRoute(location.hash);

  if (tab === 'log' && arg && placeById(places(), arg)) {
    state.draft = { ...state.draft, placeId: arg, name: '' };
    history.replaceState(null, '', '#/log');
  }

  renderChrome();
  document.querySelectorAll('.tabbar a').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab || (tab === 'place' && a.dataset.tab === 'explore')));

  const views = {
    explore: () => renderExplore(state),
    place: () => renderPlace(state, arg),
    log: () => renderLog(state),
    ask: () => renderAsk(state),
    phrases: () => renderPhrases(state, arg),
    tips: () => renderTips(state),
  };
  view.innerHTML = (views[tab] || views.explore)();
}

window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });

// ---------- State changes ----------

/** Persist the log; tell the user if the device refused. */
function saveLog() {
  if (!writeJSON(LOG_KEY, state.log)) toast(tr(state.lang, 'storageFail'));
}

/**
 * Replace (or remove, with null) the current plan and persist it.
 * @param {import('./types.js').Trip|null} trip
 */
function setTrip(trip) {
  state.trip = trip;
  state.tripDate = null;
  state.pasteOpen = false;
  if (!writeJSON(TRIP_KEY, trip)) toast(tr(state.lang, 'storageFail'));
}

/** Load a plan shared as ?trip=<https url>, then drop the parameter so reloads don't refetch. */
async function loadSharedTrip() {
  const url = tripUrlFrom(location.search);
  if (!url) return;
  history.replaceState(null, '', location.pathname + location.hash);
  const { trip, errors } = await loadTrip(url);
  if (trip) {
    setTrip(trip);
    toast(tr(state.lang, 'planLoaded', { t: trip.title }));
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

function refreshPreview() {
  const el = document.getElementById('prompt-preview');
  if (el) el.textContent = buildAskPrompt(askContext(state));
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

async function importLog(file) {
  if (!file) return;
  try {
    const { log, added } = mergeImport(state.log, JSON.parse(await file.text()));
    state.log = log;
    saveLog();
    toast(tr(state.lang, 'imported', { n: added }));
    render();
  } catch {
    toast(tr(state.lang, 'badImport'));
  }
}

function exportLog() {
  const blob = new Blob([JSON.stringify(exportPayload(state.log, new Date()), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `taiwan-trip-log-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Event dispatch (views declare data-action / data-change / data-input) ----------

const actions = {
  locate: () => locateMe(),
  'clear-location': () => { state.pos = null; render(); },
  'phrase-sheet': el => {
    const ph = state.data.phrases.find(x => x.id === el.dataset.id);
    const g = ph && PHRASE_GROUPS.find(x => x.id === ph.category);
    if (ph) openSheet(g ? `${g.icon} ${tr(state.lang, `cat.${g.id}`)}` : '', phraseCardFull(ph, state.lang));
  },
  'phrases-sheet': el => {
    const g = PHRASE_GROUPS.find(x => x.id === el.dataset.group);
    if (!g) return;
    openSheet(`${g.icon} ${tr(state.lang, `cat.${g.id}`)}`, phrasesIn(state.data.phrases, g.id).map(ph => phraseCardFull(ph, state.lang)).join(''));
  },
  'close-sheet': () => closeSheet(),
  'food-sheet': el => {
    const f = findPick(state.data.food, el.dataset.city, el.dataset.id);
    if (f) openSheet(tr(state.lang, 'foodPick'), foodSheet(f.city, f.pick, state.lang));
  },
  'dish-sheet': el => {
    const c = foodFor(state.data.food, el.dataset.city);
    const d = c && (c.to_try || []).find(x => x.id === el.dataset.id);
    if (d) openSheet(tr(state.lang, 'foodPick'), dishSheet(c, d, state.lang));
  },
  'food-driver': el => {
    const f = findPick(state.data.food, el.dataset.city, el.dataset.id);
    if (f) showBig(`<div class="big">${esc(f.pick.name)}</div><div class="mid">${esc(f.city.city_zh)}</div><div class="mid">請帶我到這裡，謝謝。</div><div class="hint">"Please take me here, thank you."</div>`);
  },
  city: el => { state.exploreCity = el.dataset.city; render(); },
  driver: el => showBig(driverCard(placeById(places(), el.dataset.id))),
  'show-phrase': el => showBig(phraseCard(state.data.phrases.find(x => x.id === el.dataset.id))),
  speak: el => {
    const ph = state.data.phrases.find(x => x.id === el.dataset.id);
    speak(ph.tts || ph.zh_TW); // tts: respelling for phrases the voice engine mispronounces
  },
  'copy-place': async el => {
    const p = placeById(places(), el.dataset.id);
    const ok = await copyText(buildPlacePrompt(p, notesFor(state.log, p.id)));
    toast(tr(state.lang, ok ? 'copiedPlace' : 'copyFail'));
  },
  star: el => {
    const n = Number(el.dataset.n);
    state.draft.stars = state.draft.stars === n ? 0 : n;
    view.querySelectorAll('.stars button').forEach(b => b.classList.toggle('on', Number(b.dataset.n) <= state.draft.stars));
  },
  'delete-entry': el => {
    if (!confirm(tr(state.lang, 'deleteNote'))) return;
    state.log = removeEntry(state.log, el.dataset.id);
    saveLog();
    render();
  },
  export: () => exportLog(),
  mode: el => { state.ask.mode = el.dataset.mode; render(); },
  'paste-plan': () => {
    const text = view.querySelector('[data-input="ai-answer"]')?.value || '';
    const { trip, errors } = planFromAiText(text, places());
    if (!trip) return toast(trMsg(state.lang, errors[0]));
    setTrip(trip);
    toast(tr(state.lang, 'planLoaded', { t: trip.title }));
    render();
  },
  'paste-plan-again': () => { state.pasteOpen = true; render(); },
  'cancel-paste': () => { state.pasteOpen = false; render(); },
  'clear-trip': () => {
    if (!confirm(tr(state.lang, 'removePlanConfirm'))) return;
    setTrip(null);
    render();
  },
  'trip-day': el => { state.tripDate = el.dataset.date; render(); },
  'copy-prompt': async () => {
    const ok = await copyText(buildAskPrompt(askContext(state)));
    toast(tr(state.lang, ok ? 'copied' : 'copyFailPreview'));
  },
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
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('bigcard').hidden) hideBig();
  else closeSheet();
});

document.getElementById('bigcard').addEventListener('click', hideBig);

// Language switch in the top bar: visible on every screen.
document.getElementById('lang-toggle').addEventListener('click', () => {
  state.lang = otherLang(state.lang);
  writeJSON(LANG_KEY, state.lang);
  if (state.ask.question === null) refreshQuestion();
  render();
});

/** Top bar, tab labels and <html lang> in the current language (they live outside #view). */
function renderChrome() {
  const L = state.lang;
  document.documentElement.lang = L === 'zh_TW' ? 'zh-Hant-TW' : 'en';
  document.getElementById('brand').textContent = tr(L, 'brand');
  document.getElementById('net-status').textContent = tr(L, 'offline');
  document.getElementById('lang-toggle').textContent = tr(L, 'switchTo');
  document.querySelectorAll('.tabbar a').forEach(a => {
    a.querySelector('[data-label]').textContent = tr(L, `tab.${a.dataset.tab}`);
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
    case 'import': await importLog(el.files[0]); break;
  }
  if (el.form?.dataset.form === 'log' && el.name) {
    state.draft[el.name] = el.value;
    if (el.name === 'placeId') view.querySelector('[data-other]').hidden = !!el.value;
  }
});

view.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.input === 'question') { state.ask.question = el.value; refreshPreview(); }
  if (el.dataset.input === 'custom-area') { state.ask.customArea = el.value; refreshQuestion(); }
  if (el.form?.dataset.form === 'log' && el.name) state.draft[el.name] = el.value;
});

view.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'log') return;
  e.preventDefault();
  const error = validateDraft(state.draft);
  if (error) return toast(trMsg(state.lang, error));
  state.log = [...state.log, makeEntry(state.draft, newId(), today())];
  saveLog();
  state.draft = emptyDraft(state.draft.date);
  toast(tr(state.lang, 'saved'));
  render();
});

// ---------- Select text, ask AI what it means ----------
// Mobile browsers don't let a page add items to the native selection menu, so a separate
// button floats above the tab bar while text inside the app is selected.

const askbar = document.getElementById('askbar');
let selection = null; // { text, context, source }, kept because tapping the button may clear the selection

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
    if (!text || !inApp || text.length > 200) { askbar.hidden = true; return; }
    const block = (node.nodeType === 1 ? node : node.parentElement)?.closest('p, li, summary, .card, details, .zc, h1, h2') || node.parentElement;
    selection = { text, context: block ? block.textContent : '', source: sourceOf() };
    const short = text.length > 16 ? text.slice(0, 15) + '…' : text;
    askbar.textContent = tr(state.lang, 'askAbout', { t: short });
    askbar.hidden = false;
  }, 250);
});

askbar.addEventListener('click', async () => {
  if (!selection) return;
  const prompt = buildExplainPrompt({ ...selection, lang: state.lang });
  const ok = await copyText(prompt);
  askbar.hidden = true;
  document.getSelection()?.removeAllRanges();
  openSheet(tr(state.lang, 'explainTitle'), `
    <p class="small ${ok ? '' : 'muted'}">${tr(state.lang, ok ? 'explainCopied' : 'copyFailPreview')}</p>
    <div class="row small" style="margin-bottom:10px">
      <span class="muted">${tr(state.lang, 'thenOpen')}</span>
      <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
      <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
      <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
    </div>
    <pre class="prompt">${esc(prompt)}</pre>`);
});

// ---------- Online status, data, service worker ----------

function updateNet() {
  document.getElementById('net-status').hidden = navigator.onLine;
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

async function init() {
  updateNet();
  try {
    state.data = await loadGuidebook();
  } catch {
    view.innerHTML = `<p>${tr(state.lang, 'loadFail')}</p>`;
    return;
  }
  render();
  await loadSharedTrip();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // sw.js posts this after a background refresh brought a different guidebook.json
  navigator.serviceWorker.addEventListener('message', async e => {
    if (e.data?.type !== 'data-updated') return;
    try {
      state.data = await loadGuidebook();
      render();
      toast(tr(state.lang, 'guideUpdated'));
    } catch { /* keep the current data */ }
  });
}

init();
