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
    brand: 'Taiwan Guidebook', offline: 'Offline', switchTo: '中文', switchLabel: '中文: switch to Chinese', loading: 'Loading…',
    loadFail: 'Could not load the guide. Connect to the internet once so it can be saved for offline use.',
    'tab.explore': 'Explore', 'tab.log': 'My trip', 'tab.ask': 'Ask AI', 'tab.phrases': 'Phrases', 'tab.tips': 'Tips',
    navLabel: 'Sections',
    distancesFrom: 'Distances from <b>{label}</b>', inCity: "I'm in <b>{label}</b>", update: 'Update', change: 'Change', useLocation: 'Use my location', nearPick: "or I'm in…",
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
    backupIntro: 'One file with your notes, your plan and your party size: send it to your own chat or mail, or move it to another phone. My stay is not in it.',
    export: 'Export', import: 'Import',
    deleteNote: 'Delete this note?', imported: 'Imported {n} new note(s).', badImport: 'That file is not a trip log export.',
    'backup.never': 'No backup yet', 'backup.today': 'Last backup today', 'backup.yesterday': 'Last backup yesterday',
    'backup.daysAgo': 'Last backup {n} days ago', 'backup.notes1': '1 note', 'backup.notesN': '{n} notes',
    'backup.since0': 'no new notes since', 'backup.since1': '1 note since', 'backup.sinceN': '{n} notes since',
    'backup.shareTitle': 'Taiwan trip backup {d}',
    'backup.planConfirm': 'The file has a plan, “{t}”. Replace your plan “{old}” with it?',
    'backup.badPlan': 'The plan in the file could not be read.',
    starN: '{n} of 5 stars', deleteEntry: 'Delete note: {name}',
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
    // Ask AI about a photo (the prompt asks the AI; the app itself says nothing about any food)
    photoMode: 'About a photo',
    photoIntro: 'Take a photo of a menu, a sign or a timetable. Copy the question, paste it into your AI app, attach the photo and send.',
    photoWhat: 'What is in the photo?',
    'photo.menu': 'Menu', 'photo.menu.hint': 'Every dish in English, what to look out for, what to order',
    'photo.sign': 'Sign or notice', 'photo.sign.hint': 'What it says and what it means for you',
    'photo.board': 'Departure board or timetable', 'photo.board.hint': 'Which train or bus to take, and from where',
    'photo.machine': 'Ticket machine or form', 'photo.machine.hint': 'What to press or write, step by step',
    'photo.label': 'Food label or ingredients', 'photo.label.hint': 'What it is and what is in it',
    photoNote: 'Anything the AI should know? (optional)', photoNotePh: "e.g. I don't eat pork. Going to Tamsui.",
    photoCopied: 'Copied. Paste it into your AI app, attach your photo and send.',
    askMenu: 'Ask AI about the menu',
    menuSteps: 'Take a photo of the menu, open your AI app, paste the question, attach the photo and send.',
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
    guideUpdated: 'Guide updated.', tapClose: 'Tap Close to close the card', close: 'Close', bigCard: 'Large text to show',
    guideGone: 'Guide updated: {names} is no longer in the guide.',
    guideGoneMany: 'Guide updated: {names} are no longer in the guide.',
    guideGoneMore: 'Guide updated: {names} and {n} more are no longer in the guide.',
    listSep: ', ',
    bigSay: 'Read aloud', bigFlip: 'Turn 180°',
    // party size
    'party.label': 'People:',
    'party.dec': 'One person fewer',
    'party.inc': 'One person more',
    'party.now': 'People: {n}',
    // My stay (My trip, Explore)
    'stay.title': 'My stay',
    'stay.intro': 'Where you are sleeping, ready to show a taxi driver. Kept on this device only: never in Ask AI questions or in the export.',
    'stay.name': "Hotel's name in Chinese",
    'stay.namePh': 'Paste it from your booking or the hotel card',
    'stay.address': 'Address in Chinese',
    'stay.addressPh': 'Paste the Chinese address, e.g. 臺南市中西區…',
    'stay.phone': 'Phone (optional)',
    'stay.phonePh': 'e.g. 06-221-0000',
    'stay.city': 'City (optional; else read from the address)',
    'stay.cityNone': 'Not set',
    'stay.save': 'Save stay',
    'stay.saved': 'Saved on this device.',
    'stay.add': 'Add a stay',
    'stay.edit': 'Edit',
    'stay.editLabel': 'Edit stay: {name}',
    'stay.remove': 'Remove',
    'stay.removeLabel': 'Remove stay: {name}',
    'stay.removeConfirm': 'Remove this stay from the phone?',
    'stay.replaceConfirm': 'You already have a stay in {city}: {name}. Replace it?',
    'stay.back': 'Take me back',
    'stay.backTo': 'Take me back: {name}',
    'stay.yours': 'Your stay: {name}',
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
    brand: '台灣旅遊手冊', offline: '離線', switchTo: 'EN', switchLabel: 'EN：切換成英文', loading: '載入中…',
    loadFail: '無法載入手冊。請先連上網路一次，之後就能離線使用。',
    'tab.explore': '探索', 'tab.log': '我的旅程', 'tab.ask': '問 AI', 'tab.phrases': '常用語', 'tab.tips': '須知',
    navLabel: '分頁',
    distancesFrom: '距離以 <b>{label}</b> 計算', inCity: '我在 <b>{label}</b>', update: '更新', change: '更換', useLocation: '使用我的位置', nearPick: '或選擇我在哪個城市…',
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
    backupIntro: '筆記、行程和人數存成一個檔案：傳到自己的聊天室或信箱，或搬到另一支手機。不含「我的住宿」。',
    export: '匯出', import: '匯入',
    deleteNote: '刪除這則筆記？', imported: '已匯入 {n} 則新筆記。', badImport: '這不是旅程筆記的匯出檔。',
    'backup.never': '還沒備份過', 'backup.today': '上次備份：今天', 'backup.yesterday': '上次備份：昨天',
    'backup.daysAgo': '上次備份：{n} 天前', 'backup.notes1': '1 則筆記', 'backup.notesN': '{n} 則筆記',
    'backup.since0': '之後沒有新筆記', 'backup.since1': '之後新增 1 則筆記', 'backup.sinceN': '之後新增 {n} 則筆記',
    'backup.shareTitle': '台灣旅程備份 {d}',
    'backup.planConfirm': '檔案裡有行程「{t}」。要用它取代目前的行程「{old}」嗎？',
    'backup.badPlan': '檔案裡的行程無法讀取。',
    starN: '{n} 顆星（滿分 5 顆）', deleteEntry: '刪除筆記：{name}',
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
    // Ask AI about a photo
    photoMode: '問照片',
    photoIntro: '拍下菜單、告示或時刻表。複製問題，貼到你的 AI，附上照片後送出。',
    photoWhat: '照片裡是什麼？',
    'photo.menu': '菜單', 'photo.menu.hint': '每道菜的英文和內容、要留意的食材、建議怎麼點',
    'photo.sign': '告示或標誌', 'photo.sign.hint': '寫了什麼、對你有什麼影響',
    'photo.board': '時刻表或發車看板', 'photo.board.hint': '該搭哪一班車、在哪裡上車',
    'photo.machine': '售票機或表單', 'photo.machine.hint': '一步一步告訴你按哪裡、填什麼',
    'photo.label': '食品標示或成分', 'photo.label.hint': '這是什麼、裡面有什麼',
    photoNote: '有什麼想讓 AI 知道的嗎？（可不填）', photoNotePh: '例如：我不吃豬肉。要去淡水。',
    photoCopied: '已複製。貼到你的 AI，附上照片後送出。',
    askMenu: '問 AI 這裡的菜單',
    menuSteps: '拍下菜單，打開你的 AI，貼上問題、附上照片後送出。',
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
    guideUpdated: '手冊已更新。', tapClose: '點「關閉」收起字卡', close: '關閉', bigCard: '放大給對方看的字卡',
    guideGone: '手冊已更新：{names}已不在手冊中。',
    guideGoneMany: '手冊已更新：{names}已不在手冊中。',
    guideGoneMore: '手冊已更新：{names}和另外 {n} 個地方已不在手冊中。',
    listSep: '、',
    bigSay: '唸出來', bigFlip: '轉 180°',
    // party size
    'party.label': '人數：',
    'party.dec': '少一人',
    'party.inc': '多一人',
    'party.now': '人數：{n}',
    // My stay (My trip, Explore)
    'stay.title': '我的住宿',
    'stay.intro': '你住的地方，隨時可以給計程車司機看。只存在這台裝置上：不會放進問 AI 的問題，也不會匯出。',
    'stay.name': '飯店中文名稱',
    'stay.namePh': '從訂房確認信或飯店名片貼上',
    'stay.address': '中文地址',
    'stay.addressPh': '貼上中文地址，例如：臺南市中西區…',
    'stay.phone': '電話（選填）',
    'stay.phonePh': '例如：06-221-0000',
    'stay.city': '城市（選填；沒選就從地址判斷）',
    'stay.cityNone': '不指定',
    'stay.save': '儲存住宿',
    'stay.saved': '已存在這台裝置上。',
    'stay.add': '新增住宿',
    'stay.edit': '編輯',
    'stay.editLabel': '編輯住宿：{name}',
    'stay.remove': '移除',
    'stay.removeLabel': '移除住宿：{name}',
    'stay.removeConfirm': '要從手機移除這筆住宿嗎？',
    'stay.replaceConfirm': '你在{city}已經有住宿：{name}。要取代它嗎？',
    'stay.back': '帶我回住處',
    'stay.backTo': '帶我回住處：{name}',
    'stay.yours': '你的住宿：{name}',
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
  "Paste the hotel's name.": '請貼上飯店名稱。',
  "Paste the hotel's address in Chinese.": '請貼上飯店的中文地址。',
  'The address has no Chinese in it. Paste the Chinese one: that is what a driver reads.': '地址裡沒有中文。請貼上中文地址：司機看的是中文。',
  'Check the phone number, or leave it empty.': '請檢查電話號碼，或留空。',
  'No plan found in the text.': '在這段文字裡找不到行程。',
  'The plan is not valid JSON.': '行程的格式不正確（不是有效的 JSON）。',
  'The trip file is not valid JSON.': '行程檔的格式不正確（不是有效的 JSON）。',
  'Could not load the trip. Check your connection.': '無法載入行程，請檢查網路連線。',
  'Could not load the trip.': '無法載入行程。',
  'The trip must be a JSON object.': '行程必須是一個 JSON 物件。',
  'The trip must have a title.': '行程必須有標題（title）。',
  'The trip must have at least one day.': '行程至少要有一天。',
};

// parseTrip's messages about one day or stop: "Day 2: …", "Day 2, stop 3: …".
const DETAIL_ZH = {
  'must be an object.': '格式不正確（必須是物件）。',
  'needs a place id or a name.': '需要地點 id（place）或名稱（name）。',
  'date must be YYYY-MM-DD, like 2026-11-04.': '日期必須是 YYYY-MM-DD，例如 2026-11-04。',
  'items must be a list.': 'items 必須是清單。',
  'title must be text.': 'title 必須是文字。',
  'place must be text.': 'place 必須是文字。',
  'name must be text.': 'name 必須是文字。',
  'time must be HH:MM, like 09:30.': '時間必須是 HH:MM，例如 09:30。',
  'note must be text.': 'note 必須是文字。',
};

/**
 * Chinese for a message with a number in it, or undefined.
 * @param {string} msg
 * @returns {string|undefined}
 */
function patternZh(msg) {
  const http = /^Could not load the trip \(HTTP (\d+)\)\.$/.exec(msg);
  if (http) return `無法載入行程（HTTP ${http[1]}）。`;
  const day = /^Day (\d+)(?:, stop (\d+))?: (.+)$/.exec(msg);
  if (day && DETAIL_ZH[day[3]]) return `第 ${day[1]} 天${day[2] ? `第 ${day[2]} 站` : ''}：${DETAIL_ZH[day[3]]}`;
  return undefined;
}

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
  return lang === 'zh_TW' ? MESSAGES_ZH[msg] ?? patternZh(msg) ?? msg : msg;
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
