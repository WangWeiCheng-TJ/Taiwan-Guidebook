// UI language: string table, content accessors, initial choice. Pure except nothing (no DOM).

import { t, tList } from './i18n.js';

/** @typedef {'en'|'zh_TW'} Lang */

export const LANGS = /** @type {const} */ (['en', 'zh_TW']);
export const LANG_KEY = 'tg.lang.v1';

/**
 * Language to start with: the saved choice, else Chinese for a zh-* browser, else English.
 * @param {unknown} stored     value read from storage
 * @param {string} [navLang]   navigator.language
 * @returns {Lang}
 */
export function initialLang(stored, navLang = '') {
  if (LANGS.includes(/** @type {any} */ (stored))) return /** @type {Lang} */ (stored);
  return navLang.toLowerCase().startsWith('zh') ? 'zh_TW' : 'en';
}

const STRINGS = {
  en: {
    brand: 'Taiwan Guidebook', offline: 'Offline', switchTo: '中文', loadFail: 'Could not load the guide. Connect to the internet once so it can be saved for offline use.',
    'tab.explore': 'Explore', 'tab.log': 'My trip', 'tab.ask': 'Ask AI', 'tab.phrases': 'Phrases', 'tab.tips': 'Tips',
    distancesFrom: 'Distances from <b>{label}</b>', update: 'Update', change: 'Change', useLocation: 'Use my location', nearPick: "or I'm in…",
    choosePlace: 'Choose a city', yourLocation: 'your location', locating: 'Finding your location…',
    noGeo: 'Location is not available on this device.', geoFail: 'Could not get your location. Pick a place instead.',
    explore: 'Explore', all: 'All', visited: 'Visited', noPlaces: 'No places yet.',
    allPlaces: '‹ All places', away: '{d} away', since: 'Since {y}', minutes: '~{n} min', navigate: 'Navigate',
    driver: 'Show to driver', wasHere: 'I was here', copyAi: 'Copy for AI', appleMaps: 'Open in Apple Maps',
    yourNotes: 'Your notes', dontMiss: "Don't miss", tapWhy: 'Tap one to see why.', etiquette: 'Etiquette', bestTime: 'Best time', gettingThere: 'Getting there',
    story: 'The story', whyMatters: 'Why it matters.', lookFor: 'Look for.', timeline: 'Timeline', notFound: 'Place not found.', back: 'Back',
    copiedPlace: 'Copied. Paste it into your AI app and add your question.', copyFail: 'Copy failed.',
    myTrip: 'My trip', notes: 'Notes', notesIntro: "Saved only on this phone. Ask AI adds these notes to your question, so it learns what you like and what you don't.",
    date: 'Date', where: 'Where', elsewhere: 'Somewhere else (type below)', nameLabel: 'Name of the place, food, or activity',
    namePh: 'e.g. Curry shop near Yongkang St.', rating: 'Rating (optional)', note: 'Note', notePh: 'e.g. Too salty for me. Loved the old street.',
    save: 'Save', saved: 'Saved.', nothingLogged: 'Nothing logged yet.', dayN: 'day {n}', backup: 'Backup',
    backupIntro: 'Move your notes to another phone, or keep a copy.', export: 'Export', import: 'Import',
    deleteNote: 'Delete this note?', imported: 'Imported {n} new note(s).', badImport: 'That file is not a trip log export.',
    storageFail: 'Could not save on this device (storage blocked or full).',
    myPlan: 'My plan', pasteIntro: 'In <a href="#/ask">Ask AI</a>, tick <b>Ask for a plan I can paste back</b>, send it to your AI, then paste its whole answer here.',
    pastePh: "Paste the AI's answer here", loadPlan: 'Load plan', cancel: 'Cancel', replacePlan: 'Replace plan', removePlan: 'Remove plan',
    days: '{n} day(s)', today: 'today', nothingPlanned: 'Nothing planned for this day.', notInGuide: 'not in guidebook',
    todaysPlan: "Today's plan", planLoaded: 'Plan loaded: {t}', removePlanConfirm: 'Remove this plan from the phone?',
    askTitle: 'Ask AI', askIntro: 'Builds a question with your trip notes and guidebook places. Copy it, then paste into ChatGPT, Claude, Gemini or any AI you use.',
    nearMe: 'Near me now', planDay: 'Plan a day', within: 'Within', when: 'When', tomorrow: 'Tomorrow', todayOpt: 'Today',
    area: 'Area', typeArea: 'Type an area…', areaName: 'Area name', areaPh: "e.g. Da'an District, Taipei",
    yourQuestion: 'Your question', includeNotes: 'Include my trip notes ({n})', wantPlan: 'Ask for a plan I can paste back',
    copyQuestion: 'Copy question', thenOpen: 'Then open:', preview: 'Preview',
    copied: 'Copied. Now paste it into your AI app.', copyFailPreview: 'Copy failed. Select the preview text instead.',
    phrases: 'Phrases', phrasesIntro: "Tap <b>Show</b> to display it big for the person you're talking to.", play: '▶ Play', show: 'Show',
    toneLegend: 'Numbers are the tones as spoken: 1 high · 2 rising · 3 low · 4 falling · 5 light',
    pickCategory: 'What do you need to say?', allCategories: '‹ All categories', usefulHere: 'Useful here', morePhrases: 'More phrases ›',
    'cat.top': 'Most used', 'cat.sightseeing': 'Sightseeing', 'cat.basics': 'Basics', 'cat.food': 'Food', 'cat.transport': 'Transport', 'cat.shopping': 'Shopping', 'cat.emergency': 'Emergency',
    tips: 'Good to know', 'cat.safety': 'Safety', 'cat.daily-life': 'Daily life', 'cat.money': 'Money', 'cat.culture': 'Culture',
    foodPicksIn: 'Food picks in {city}', foodPick: 'Food pick', foodIntro: 'Places the guide’s author likes. Navigate searches Google Maps by name.',
    foodNoAddress: 'No address in the guide: Navigate looks it up on Google Maps.',
    shopTbd: 'shop TBD', shopTbdIntro: 'A local dish worth trying. The author hasn’t picked a shop yet: look for one nearby, or ask AI.', findNearby: 'Find nearby',
    'food.local': 'Local specialties', 'food.taiwanese': 'Taiwanese local food', 'food.hotpot': 'Hot pot', 'food.beef_noodles': 'Beef noodles', 'food.ramen': 'Ramen', 'food.japanese': 'Japanese',
    'food.international': 'International', 'food.sweets': 'Desserts', 'food.bar': 'Bar',
    listen: 'Listen', noSpeech: 'This device can’t play speech.', tapToHear: 'Tap a character to hear it.',
    askAbout: '✦ Ask AI: “{t}”', explainTitle: 'Ask AI', explainCopied: 'Copied. Paste it into your AI app.',
    guideUpdated: 'Guide updated.', tapClose: 'Tap anywhere to close', close: 'Close',
    // party size
    'party.label': 'People:',
    'party.dec': 'One person fewer',
    'party.inc': 'One person more',
    // apps and learn
    'apps.title': 'Recommended apps', 'apps.intro': 'Apps that make a trip in Taiwan easier. Install them before you go: app stores need a connection.',
    'apps.open': 'Official page ›', 'apps.none': 'No apps listed yet.', 'apps.ios': 'iOS', 'apps.android': 'Android',
    'apps.cat.getting-around': 'Getting around', 'apps.cat.taxi': 'Taxis', 'apps.cat.trains': 'Trains', 'apps.cat.messaging': 'Messaging',
    'apps.cat.language': 'Language', 'apps.cat.weather': 'Weather', 'apps.cat.food': 'Food',
    'learn.title': 'Learn about Taiwan', 'learn.intro': 'Short background reads that help you make sense of what you see.',
    'learn.all': '‹ All topics', 'learn.none': 'No topics yet.', 'learn.notFound': 'Topic not found.', 'learn.more': 'Learn more',
    'learn.places': 'Places', 'learn.sources': 'Sources', 'learn.pending': 'Draft: the guide’s author has not checked this yet.',
    'learn.backTips': '‹ Good to know',
    'photo.credit': 'Photo: {author}', 'map.title': 'Map', 'map.of': 'Map of {name}', 'map.open': 'Open in OpenStreetMap',
    'map.online': 'The map needs an internet connection.',
  },
  zh_TW: {
    brand: '台灣旅遊手冊', offline: '離線', switchTo: 'EN', loadFail: '無法載入手冊。請先連上網路一次，之後就能離線使用。',
    'tab.explore': '探索', 'tab.log': '我的旅程', 'tab.ask': '問 AI', 'tab.phrases': '常用語', 'tab.tips': '須知',
    distancesFrom: '距離以 <b>{label}</b> 計算', update: '更新', change: '更換', useLocation: '使用我的位置', nearPick: '或選擇我在哪個城市…',
    choosePlace: '選擇城市', yourLocation: '目前位置', locating: '正在取得位置…',
    noGeo: '這台裝置無法使用定位。', geoFail: '無法取得位置，請改選一個地點。',
    explore: '探索', all: '全部', visited: '去過', noPlaces: '目前還沒有景點。',
    allPlaces: '‹ 所有景點', away: '距離 {d}', since: '建於 {y}', minutes: '約 {n} 分鐘', navigate: '導航',
    driver: '給司機看', wasHere: '我去過', copyAi: '複製給 AI', appleMaps: '用 Apple 地圖開啟',
    yourNotes: '我的筆記', dontMiss: '必看', tapWhy: '點一下看為什麼值得看。', etiquette: '參訪禮儀', bestTime: '最佳時段', gettingThere: '交通方式',
    story: '歷史故事', whyMatters: '為什麼重要：', lookFor: '看點：', timeline: '年表', notFound: '找不到這個景點。', back: '返回',
    copiedPlace: '已複製。貼到你的 AI，再加上你的問題。', copyFail: '複製失敗。',
    myTrip: '我的旅程', notes: '筆記', notesIntro: '只存在這支手機上。問 AI 時會附上這些筆記，讓 AI 知道你喜歡和不喜歡什麼。',
    date: '日期', where: '地點', elsewhere: '其他地方（在下方輸入）', nameLabel: '地點、食物或活動名稱',
    namePh: '例如：永康街附近的咖哩店', rating: '評分（可不填）', note: '筆記', notePh: '例如：對我來說太鹹。老街很喜歡。',
    save: '儲存', saved: '已儲存。', nothingLogged: '還沒有紀錄。', dayN: '第 {n} 天', backup: '備份',
    backupIntro: '把筆記搬到另一支手機，或留一份備份。', export: '匯出', import: '匯入',
    deleteNote: '刪除這則筆記？', imported: '已匯入 {n} 則新筆記。', badImport: '這不是旅程筆記的匯出檔。',
    storageFail: '無法儲存在這台裝置上（儲存空間被封鎖或已滿）。',
    myPlan: '我的行程', pasteIntro: '在<a href="#/ask">問 AI</a>勾選<b>請 AI 給我可以貼回來的行程</b>，送給你的 AI，再把它的完整回答貼在這裡。',
    pastePh: '把 AI 的回答貼在這裡', loadPlan: '載入行程', cancel: '取消', replacePlan: '換一份行程', removePlan: '移除行程',
    days: '{n} 天', today: '今天', nothingPlanned: '這天沒有安排。', notInGuide: '不在手冊中',
    todaysPlan: '今天的行程', planLoaded: '已載入行程：{t}', removePlanConfirm: '要從手機移除這份行程嗎？',
    askTitle: '問 AI', askIntro: '把你的旅程筆記和手冊裡的景點組成一個問題。複製後貼到 ChatGPT、Claude、Gemini 或任何你用的 AI。',
    nearMe: '我附近', planDay: '規劃一天', within: '範圍', when: '時間', tomorrow: '明天', todayOpt: '今天',
    area: '區域', typeArea: '自行輸入區域…', areaName: '區域名稱', areaPh: '例如：台北市大安區',
    yourQuestion: '你的問題', includeNotes: '附上我的旅程筆記（{n}）', wantPlan: '請 AI 給我可以貼回來的行程',
    copyQuestion: '複製問題', thenOpen: '接著打開：', preview: '預覽',
    copied: '已複製，現在貼到你的 AI。', copyFailPreview: '複製失敗，請直接選取預覽的文字。',
    phrases: '常用語', phrasesIntro: '點<b>顯示</b>，把字放大給對方看。', play: '▶ 播放', show: '顯示',
    toneLegend: '數字是實際唸的聲調：1 一聲 · 2 二聲 · 3 三聲 · 4 四聲 · 5 輕聲',
    pickCategory: '你想說什麼？', allCategories: '‹ 所有類別', usefulHere: '這裡用得到的話', morePhrases: '更多常用語 ›',
    'cat.top': '最常用', 'cat.sightseeing': '參觀', 'cat.basics': '基本', 'cat.food': '餐飲', 'cat.transport': '交通', 'cat.shopping': '購物', 'cat.emergency': '緊急',
    tips: '旅遊須知', 'cat.safety': '安全', 'cat.daily-life': '日常生活', 'cat.money': '金錢', 'cat.culture': '文化',
    foodPicksIn: '{city}美食推薦', foodPick: '美食推薦', foodIntro: '手冊作者喜歡的店。導航會用店名在 Google 地圖搜尋。',
    foodNoAddress: '手冊裡沒有地址，導航會用店名在 Google 地圖搜尋。',
    shopTbd: '店家待補', shopTbdIntro: '值得一試的在地小吃，作者還沒選定店家：可以搜尋附近的店，或問 AI。', findNearby: '搜尋附近',
    'food.local': '當地特色', 'food.taiwanese': '台灣小吃', 'food.hotpot': '火鍋', 'food.beef_noodles': '牛肉麵', 'food.ramen': '拉麵', 'food.japanese': '日式',
    'food.international': '異國料理', 'food.sweets': '甜點', 'food.bar': '酒吧',
    listen: '聽發音', noSpeech: '這台裝置無法播放語音。', tapToHear: '點單一個字可以聽它的發音。',
    askAbout: '✦ 問 AI：「{t}」', explainTitle: '問 AI', explainCopied: '已複製，貼到你的 AI 就可以問了。',
    guideUpdated: '手冊已更新。', tapClose: '點任何地方關閉', close: '關閉',
    // party size
    'party.label': '人數：',
    'party.dec': '少一人',
    'party.inc': '多一人',
    // apps and learn
    'apps.title': '推薦 App', 'apps.intro': '讓在台灣旅行更順手的 App。出發前先裝好：下載 App 需要網路。',
    'apps.open': '官方網頁 ›', 'apps.none': '還沒有推薦的 App。', 'apps.ios': 'iOS', 'apps.android': 'Android',
    'apps.cat.getting-around': '交通導航', 'apps.cat.taxi': '計程車', 'apps.cat.trains': '火車', 'apps.cat.messaging': '通訊',
    'apps.cat.language': '語言', 'apps.cat.weather': '天氣', 'apps.cat.food': '美食',
    'learn.title': '認識台灣', 'learn.intro': '簡短的背景知識，幫你看懂眼前的景點。',
    'learn.all': '‹ 所有主題', 'learn.none': '目前還沒有主題。', 'learn.notFound': '找不到這個主題。', 'learn.more': '延伸閱讀',
    'learn.places': '相關景點', 'learn.sources': '資料來源', 'learn.pending': '草稿：手冊作者還沒有審閱這篇。',
    'learn.backTips': '‹ 旅遊須知',
    'photo.credit': '照片：{author}', 'map.title': '地圖', 'map.of': '{name}的地圖', 'map.open': '用 OpenStreetMap 開啟',
    'map.online': '地圖需要網路連線。',
  },
};

// Messages produced by pure modules (in English) that the UI shows as toasts.
const MESSAGES_ZH = {
  'Pick a place or type a name.': '請選擇地點或輸入名稱。',
  'Add a rating or a note.': '請給個評分或寫一句筆記。',
  'No plan found in the text.': '在這段文字裡找不到行程。',
  'The plan is not valid JSON.': '行程的格式不正確（不是有效的 JSON）。',
  'The trip file is not valid JSON.': '行程檔的格式不正確（不是有效的 JSON）。',
  'Could not load the trip. Check your connection.': '無法載入行程，請檢查網路連線。',
};

/**
 * A UI string with {name} placeholders filled. Falls back to English, then to the key itself.
 * Values are inserted as is: escape data before passing it in when the result goes into HTML.
 * @param {Lang} lang
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function tr(lang, key, vars = {}) {
  const s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * Translate a known English message from a pure module; unknown messages stay English.
 * @param {Lang} lang
 * @param {string} msg
 * @returns {string}
 */
export function trMsg(lang, msg) {
  return lang === 'zh_TW' ? MESSAGES_ZH[msg] ?? msg : msg;
}

/**
 * Content text in the chosen language. Works with both data formats:
 * - per-language map:  obj[key] = { en, zh_TW, ... }   (schema v2, and name/summary today)
 * - paired fields:     obj[key + '_en'], obj[key + '_zh'] (schema v1)
 * - plain string:      obj[key] (not translated) is returned as is
 * Falls back to English, then any language.
 * @param {Record<string, any>|null|undefined} obj
 * @param {string} key
 * @param {Lang} lang
 * @returns {string}
 */
export function localized(obj, key, lang) {
  if (!obj) return '';
  if (obj[key] !== undefined) return t(obj[key], lang);
  return t({ en: obj[`${key}_en`], zh_TW: obj[`${key}_zh`] }, lang);
}

/**
 * List version of localized(), e.g. must_see_spots.
 * @param {Record<string, any>|null|undefined} obj
 * @param {string} key
 * @param {Lang} lang
 * @returns {string[]}
 */
export function localizedList(obj, key, lang) {
  if (!obj) return [];
  if (obj[key] !== undefined) return tList(obj[key], lang);
  return tList({ en: obj[`${key}_en`], zh_TW: obj[`${key}_zh`] }, lang);
}

/**
 * The other language, for the switch button.
 * @param {Lang} lang
 * @returns {Lang}
 */
export function otherLang(lang) {
  return lang === 'en' ? 'zh_TW' : 'en';
}
