/**
 * Taiwan Historical & Cultural Guidebook - Interactive Web Application Logic
 * Supports bilingual display (EN / zh_TW), era filtering, search, timeline view,
 * audio guide synthesis, and developer snippet integration.
 */

// Application State
const state = {
  lang: 'zh_TW', // 'zh_TW' or 'en'
  selectedEra: 'all',
  selectedCategory: 'all',
  searchQuery: '',
  activeView: 'grid', // 'grid' or 'timeline'
  data: null,
  activeSpot: null,
  isSpeaking: false
};

// Language Dictionary for UI strings
const i18n = {
  zh_TW: {
    brandTitle: "臺灣歷史文化景點庫",
    brandSubtitle: "Taiwan Historical & Cultural Guidebook DB",
    heroBadge: "穿越四百年的島嶼時光與多元文明",
    heroTitle: `穿越四百年的島嶼時光<br><span class="gradient-text">為國際旅人淬鍊的文化深度指南</span>`,
    heroDesc: "從大航海時代的荷西城堡、明鄭首學、清領閩南古剎，到日治工藝洋樓與現代地景。提供開放結構化 JSON 資料庫，讓網站、App 與旅人一覽臺灣深邃的歷史沿革與文化記憶。",
    btnRaw: "JSON API 資料",
    statAttractions: "精選歷史名勝",
    statEras: "涵蓋歷史朝代",
    statTimeline: "重大歷史紀年",
    statBilingual: "中英雙語考證",
    searchPlaceholder: "搜尋景點、城市、歷史人物、建築特色或關鍵字...",
    filterEraLabel: "歷史時代",
    filterCatLabel: "景點類型",
    allEras: "全部時代",
    allCats: "全部類型",
    resultsCount: (count) => `顯示 <strong>${count}</strong> 處歷史名勝`,
    viewTimelineTitle: "全島歷史演進總時間軸",
    viewTimelineDesc: "依照歷史年份串連各景點重大沿革事件，一覽臺灣多元政權與跨文化交流軌跡。",
    apiTitle: "如何將此資料庫整合至您的網站或 App？",
    apiDesc: "資料庫為開放標準 JSON 格式，可透過 GitHub Raw、CDN 或本機 API 隨時介接。",
    footerDesc: "以開放資料與文化考證為核心，紀錄這座島嶼四百年以來的歷史脈動與建築精髓。",
    viewDetailBtn: "探索歷史沿革",
    timelineHeader: "歷史沿革與重大紀年",
    architecturalHighlights: "建築美學與結構看點",
    whyItMatters: "歷史文化重要性",
    visitorGuide: "國際旅人參觀錦囊",
    etiquette: "文化禮儀與參觀須知",
    mustSee: "核心看點",
    transport: "大眾運輸交通",
    listenAudio: "聆聽語音導覽",
    stopAudio: "停止朗讀",
    copied: "已複製！",
    copyCode: "複製代碼",
    established: "創建年代",
    viewOnMap: "在 Google 地圖開啟"
  },
  en: {
    brandTitle: "Taiwan Historical Travel DB",
    brandSubtitle: "Taiwan Historical & Cultural Guidebook Open Data",
    heroBadge: "400+ Years of Formosan History & Living Culture",
    heroTitle: `400 Years of Formosa's Journey<br><span class="gradient-text">Deep Cultural & Historical Guidebook</span>`,
    heroDesc: "From 17th-century European fortresses and Ming-dynasty academies to Qing merchant temples, Japanese Art Deco shophouses, and modern heritage landscapes. An open structured JSON database designed for international travelers and developers.",
    btnRaw: "JSON API Dataset",
    statAttractions: "Heritage Sites",
    statEras: "Historical Eras",
    statTimeline: "Historical Milestones",
    statBilingual: "Bilingual Certified",
    searchPlaceholder: "Search attractions, cities, eras, architecture, keywords...",
    filterEraLabel: "Historical Era",
    filterCatLabel: "Category",
    allEras: "All Eras",
    allCats: "All Categories",
    resultsCount: (count) => `Showing <strong>${count}</strong> heritage attractions`,
    viewTimelineTitle: "Chronological Master Timeline of Taiwan",
    viewTimelineDesc: "Explore historical milestones connected across centuries of international contact, colonial epochs, and cultural syntheses.",
    apiTitle: "How to Integrate This Database into Your App or Website?",
    apiDesc: "Available as an open-standard JSON dataset via GitHub Raw, CDN, or local REST endpoints.",
    footerDesc: "Preserving and celebrating four centuries of Taiwanese historical identity and architectural masterworks through open data.",
    viewDetailBtn: "Explore History & Timeline",
    timelineHeader: "Historical Timeline & Milestones",
    architecturalHighlights: "Architectural & Artistic Highlights",
    whyItMatters: "Why This Site Matters",
    visitorGuide: "International Visitor Guide",
    etiquette: "Cultural Etiquette & Tips",
    mustSee: "Must-See Highlights",
    transport: "Public Transit Directions",
    listenAudio: "Listen to Audio Guide",
    stopAudio: "Stop Audio",
    copied: "Copied!",
    copyCode: "Copy Code",
    established: "Est. Year",
    viewOnMap: "Open in Google Maps"
  }
};

// Era Definitions with canonical names
const ERA_LIST = [
  "Prehistoric & Indigenous",
  "Dutch & Spanish Era (1624–1662)",
  "Kingdom of Tungning (1661–1683)",
  "Qing Dynasty (1683–1895)",
  "Japanese Colonial Era (1895–1945)",
  "Post-WWII & Modern Era (1945–present)"
];

const ERA_LABELS_ZH = {
  "Prehistoric & Indigenous": "史前與原住民時期",
  "Dutch & Spanish Era (1624–1662)": "荷西時期 (1624–1662)",
  "Kingdom of Tungning (1661–1683)": "明鄭時期 (1661–1683)",
  "Qing Dynasty (1683–1895)": "清領時期 (1683–1895)",
  "Japanese Colonial Era (1895–1945)": "日治時期 (1895–1945)",
  "Post-WWII & Modern Era (1945–present)": "戰後與當代 (1945–迄今)"
};

// Embedded Fallback Data in case file is opened directly via file:// protocol
const FALLBACK_DATA = {
  metadata: {
    title: "Taiwan Historical & Cultural Attractions Database",
    version: "1.0.0",
    total_count: 6
  },
  attractions: []
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await loadAttractionsData();
  renderEraPills();
  renderApp();
});

// Load Dataset
async function loadAttractionsData() {
  try {
    const res = await fetch('../data/taiwan_attractions.json');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    state.data = await res.json();
  } catch (e) {
    console.warn("Fetch from relative path failed, trying fallback / embedded mechanism:", e);
    // If fetching individual files failed (e.g. file:// CORS), try fetching from same directory or use loaded
    try {
      const res = await fetch('taiwan_attractions.json');
      state.data = await res.json();
    } catch (e2) {
      console.log("Using direct dynamic import or fallback data structure");
      state.data = FALLBACK_DATA;
    }
  }

  // Update stats
  if (state.data && state.data.attractions) {
    document.getElementById('stat-attraction-count').textContent = state.data.attractions.length;
    let milestoneCount = 0;
    state.data.attractions.forEach(a => {
      if (a.timeline) milestoneCount += a.timeline.length;
    });
    document.getElementById('stat-timeline-count').textContent = milestoneCount;
  }
}

// Render Era Filter Buttons
function renderEraPills() {
  const container = document.getElementById('era-pills-container');
  container.innerHTML = '';

  const allPill = document.createElement('button');
  allPill.className = `era-pill ${state.selectedEra === 'all' ? 'active' : ''}`;
  allPill.textContent = state.lang === 'zh_TW' ? '全部時代' : 'All Eras';
  allPill.addEventListener('click', () => {
    state.selectedEra = 'all';
    updatePillsActiveState();
    renderApp();
  });
  container.appendChild(allPill);

  ERA_LIST.forEach(era => {
    const pill = document.createElement('button');
    pill.className = `era-pill ${state.selectedEra === era ? 'active' : ''}`;
    pill.textContent = state.lang === 'zh_TW' ? (ERA_LABELS_ZH[era] || era) : era;
    pill.addEventListener('click', () => {
      state.selectedEra = era;
      updatePillsActiveState();
      renderApp();
    });
    container.appendChild(pill);
  });
}

function updatePillsActiveState() {
  const pills = document.querySelectorAll('.era-pill');
  pills.forEach((p, idx) => {
    if (idx === 0) {
      p.classList.toggle('active', state.selectedEra === 'all');
    } else {
      const era = ERA_LIST[idx - 1];
      p.classList.toggle('active', state.selectedEra === era);
    }
  });
}

// Filter attractions based on search, era, and category
function getFilteredAttractions() {
  if (!state.data || !state.data.attractions) return [];

  return state.data.attractions.filter(item => {
    // Era match
    if (state.selectedEra !== 'all' && (!item.eras || !item.eras.includes(state.selectedEra))) {
      return false;
    }

    // Category match
    if (state.selectedCategory !== 'all' && item.category !== state.selectedCategory) {
      return false;
    }

    // Search query match
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      const zhName = item.name?.zh_TW?.toLowerCase() || '';
      const enName = item.name?.en?.toLowerCase() || '';
      const cityZh = item.location?.city_zh?.toLowerCase() || '';
      const cityEn = item.location?.city_en?.toLowerCase() || '';
      const summaryZh = item.summary?.zh_TW?.toLowerCase() || '';
      const summaryEn = item.summary?.en?.toLowerCase() || '';
      const tags = (item.tags || []).join(' ').toLowerCase();
      const narrativeZh = item.historical_narrative?.zh_TW?.toLowerCase() || '';
      const narrativeEn = item.historical_narrative?.en?.toLowerCase() || '';

      const match = zhName.includes(q) || enName.includes(q) ||
                    cityZh.includes(q) || cityEn.includes(q) ||
                    summaryZh.includes(q) || summaryEn.includes(q) ||
                    tags.includes(q) || narrativeZh.includes(q) || narrativeEn.includes(q);
      if (!match) return false;
    }

    return true;
  });
}

// Main Render Function
function renderApp() {
  updateUIStrings();
  const filtered = getFilteredAttractions();

  // Results count
  const countEl = document.getElementById('results-count-text');
  if (countEl) {
    countEl.innerHTML = i18n[state.lang].resultsCount(filtered.length);
  }

  if (state.activeView === 'grid') {
    renderGridView(filtered);
    document.getElementById('attractions-grid').classList.remove('hidden');
    document.getElementById('master-timeline-view').classList.add('hidden');
  } else {
    renderTimelineView(filtered);
    document.getElementById('attractions-grid').classList.add('hidden');
    document.getElementById('master-timeline-view').classList.remove('hidden');
  }
}

// Render Grid of Attraction Cards
function renderGridView(attractions) {
  const container = document.getElementById('attractions-grid');
  container.innerHTML = '';

  if (attractions.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <i class="fa-solid fa-compass" style="font-size: 3rem; margin-bottom: 16px; color: var(--text-muted);"></i>
        <h3>${state.lang === 'zh_TW' ? '找不到符合條件的歷史景點' : 'No attractions found matching your criteria'}</h3>
        <p style="margin-top: 8px;">${state.lang === 'zh_TW' ? '請嘗試調整搜尋關鍵字或時代篩選。' : 'Try clearing filters or searching for other keywords.'}</p>
      </div>
    `;
    return;
  }

  attractions.forEach(spot => {
    const card = document.createElement('div');
    card.className = 'attraction-card';

    const zhName = spot.name?.zh_TW || '';
    const enName = spot.name?.en || '';
    const city = state.lang === 'zh_TW' ? (spot.location?.city_zh + ' ' + spot.location?.district_zh) : (spot.location?.city_en);
    const summary = state.lang === 'zh_TW' ? spot.summary?.zh_TW : spot.summary?.en;
    const estYear = spot.established_year ? `${i18n[state.lang].established}: ${spot.established_year}` : '';
    const heritage = spot.heritage_status || '';

    // First milestone preview
    const firstEvent = spot.timeline && spot.timeline.length > 0 ? spot.timeline[0] : null;
    const eventText = firstEvent ? (state.lang === 'zh_TW' ? firstEvent.event_zh : firstEvent.event_en) : '';
    const eventYear = firstEvent ? firstEvent.year_or_era : '';

    const erasHTML = (spot.eras || []).map(e => {
      const label = state.lang === 'zh_TW' ? (ERA_LABELS_ZH[e] || e) : e;
      return `<span class="era-tag">${label}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="card-top">
        <div class="card-location-badge">
          <i class="fa-solid fa-location-dot"></i>
          <span>${city}</span>
        </div>
        ${estYear ? `<div class="card-year-badge">${estYear}</div>` : ''}
      </div>

      <div class="card-main">
        <div class="card-title-group">
          <h3 class="card-title-zh">${state.lang === 'zh_TW' ? zhName : enName}</h3>
          <h4 class="card-title-en">${state.lang === 'zh_TW' ? enName : zhName}</h4>
        </div>

        <p class="card-summary">${summary}</p>

        <div class="card-eras-list">
          ${erasHTML}
        </div>

        ${firstEvent ? `
          <div class="card-timeline-preview">
            <div class="card-timeline-item">
              <strong>${eventYear}：</strong> ${eventText}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="card-footer">
        <div class="card-heritage-label">${heritage.split('(')[0].trim()}</div>
        <div class="card-action-btn">
          <span>${i18n[state.lang].viewDetailBtn}</span>
          <i class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      openDetailModal(spot);
    });

    container.appendChild(card);
  });
}

// Render Master Chronological Timeline
function renderTimelineView(attractions) {
  const container = document.getElementById('timeline-tree-container');
  container.innerHTML = '';

  // Aggregate all milestones from filtered attractions
  const allEvents = [];
  attractions.forEach(spot => {
    if (spot.timeline) {
      spot.timeline.forEach(t => {
        allEvents.push({
          year_or_era: t.year_or_era,
          era_category: t.era_category || '',
          event_zh: t.event_zh,
          event_en: t.event_en,
          spot_name_zh: spot.name.zh_TW,
          spot_name_en: spot.name.en,
          spot: spot
        });
      });
    }
  });

  // Sort chronologically (extract numeric year if possible)
  allEvents.sort((a, b) => {
    const numA = parseInt(a.year_or_era.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.year_or_era.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  allEvents.forEach((ev, idx) => {
    const node = document.createElement('div');
    node.className = `timeline-node ${idx % 2 === 0 ? 'left' : 'right'}`;

    const title = state.lang === 'zh_TW' ? ev.spot_name_zh : ev.spot_name_en;
    const eventDesc = state.lang === 'zh_TW' ? ev.event_zh : ev.event_en;

    node.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-card">
        <div class="timeline-year">${ev.year_or_era} ${ev.era_category ? `(${ev.era_category})` : ''}</div>
        <div class="timeline-spot-title">${title}</div>
        <div class="timeline-event-text">${eventDesc}</div>
      </div>
    `;

    node.querySelector('.timeline-card').addEventListener('click', () => {
      openDetailModal(ev.spot);
    });

    container.appendChild(node);
  });
}

// Detail Modal Management
function openDetailModal(spot) {
  state.activeSpot = spot;
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('modal-body-content');

  const zhName = spot.name?.zh_TW || '';
  const enName = spot.name?.en || '';
  const primaryTitle = state.lang === 'zh_TW' ? zhName : enName;
  const secondaryTitle = state.lang === 'zh_TW' ? enName : zhName;
  const address = state.lang === 'zh_TW' ? spot.location?.address_zh : spot.location?.address_en;
  const narrative = state.lang === 'zh_TW' ? spot.historical_narrative?.zh_TW : spot.historical_narrative?.en;
  const whyItMatters = state.lang === 'zh_TW' ? spot.cultural_significance?.why_it_matters_zh : spot.cultural_significance?.why_it_matters_en;
  const archHighlights = state.lang === 'zh_TW' ? spot.cultural_significance?.architectural_highlights_zh : spot.cultural_significance?.architectural_highlights_en;
  const etiquette = state.lang === 'zh_TW' ? spot.foreign_visitor_guide?.etiquette_tips_zh : spot.foreign_visitor_guide?.etiquette_tips_en;
  const transport = state.lang === 'zh_TW' ? spot.foreign_visitor_guide?.transportation_zh : spot.foreign_visitor_guide?.transportation_en;
  const mustSeeList = state.lang === 'zh_TW' ? spot.foreign_visitor_guide?.must_see_spots_zh : spot.foreign_visitor_guide?.must_see_spots_en;

  const lat = spot.location?.coordinates?.lat || 25.0;
  const lng = spot.location?.coordinates?.lng || 121.5;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const timelineHTML = (spot.timeline || []).map(t => {
    const desc = state.lang === 'zh_TW' ? t.event_zh : t.event_en;
    return `
      <div class="modal-timeline-item">
        <div class="modal-timeline-year">${t.year_or_era}</div>
        <div class="modal-timeline-desc">${desc}</div>
      </div>
    `;
  }).join('');

  const mustSeeHTML = (mustSeeList || []).map(item => `
    <li><i class="fa-solid fa-circle-check"></i> <span>${item}</span></li>
  `).join('');

  const erasHTML = (spot.eras || []).map(e => {
    const label = state.lang === 'zh_TW' ? (ERA_LABELS_ZH[e] || e) : e;
    return `<span class="era-tag" style="background:var(--accent-crimson); color:#fff;">${label}</span>`;
  }).join('');

  body.innerHTML = `
    <div class="modal-header-section">
      <div class="modal-badges">
        <span class="card-location-badge"><i class="fa-solid fa-map-pin"></i> ${state.lang === 'zh_TW' ? spot.location.city_zh : spot.location.city_en}</span>
        ${erasHTML}
        ${spot.heritage_status ? `<span class="era-tag">${spot.heritage_status}</span>` : ''}
      </div>

      <h2 class="modal-title-zh">${primaryTitle}</h2>
      <h3 class="modal-title-en">${secondaryTitle}</h3>

      <div class="modal-location-bar">
        <span><i class="fa-solid fa-location-arrow"></i> ${address}</span>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> ${i18n[state.lang].viewOnMap}
        </a>
      </div>

      <!-- Web Speech Audio Guide -->
      <div class="audio-guide-bar">
        <button id="btn-play-audio" class="btn btn-glass" style="padding: 6px 14px; font-size: 0.85rem;">
          <i class="fa-solid fa-volume-high"></i>
          <span id="audio-btn-label">${i18n[state.lang].listenAudio}</span>
        </button>
        <span><i class="fa-solid fa-headphones"></i> Web Speech API AI Voice Guide</span>
      </div>
    </div>

    <!-- Historical Narrative -->
    <div class="modal-section">
      <h4 class="modal-section-title">
        <i class="fa-solid fa-book-bookmark"></i>
        ${state.lang === 'zh_TW' ? '深度歷史沿革與時代更迭' : 'Historical Narrative & Significance'}
      </h4>
      <div class="modal-narrative">${narrative}</div>
    </div>

    <!-- Timeline -->
    <div class="modal-section">
      <h4 class="modal-section-title">
        <i class="fa-solid fa-timeline"></i>
        ${i18n[state.lang].timelineHeader}
      </h4>
      <div class="modal-timeline-list">
        ${timelineHTML}
      </div>
    </div>

    <!-- Cultural & Architectural Highlights -->
    <div class="modal-section">
      <h4 class="modal-section-title">
        <i class="fa-solid fa-landmark"></i>
        ${i18n[state.lang].architecturalHighlights}
      </h4>
      <div class="highlights-grid">
        <div class="highlight-box">
          <h5><i class="fa-solid fa-monument"></i> ${i18n[state.lang].whyItMatters}</h5>
          <p>${whyItMatters}</p>
        </div>
        <div class="highlight-box">
          <h5><i class="fa-solid fa-brush"></i> ${i18n[state.lang].architecturalHighlights}</h5>
          <p>${archHighlights}</p>
        </div>
      </div>
    </div>

    <!-- Foreign Visitor Guide -->
    <div class="modal-section">
      <h4 class="modal-section-title">
        <i class="fa-solid fa-passport"></i>
        ${i18n[state.lang].visitorGuide}
      </h4>
      <div class="highlights-grid" style="margin-bottom: 16px;">
        <div class="highlight-box">
          <h5><i class="fa-solid fa-circle-exclamation"></i> ${i18n[state.lang].etiquette}</h5>
          <p>${etiquette}</p>
        </div>
        <div class="highlight-box">
          <h5><i class="fa-solid fa-train-subway"></i> ${i18n[state.lang].transport}</h5>
          <p>${transport}</p>
        </div>
      </div>
      <div class="highlight-box">
        <h5><i class="fa-solid fa-star"></i> ${i18n[state.lang].mustSee}</h5>
        <ul class="visitor-checklist">
          ${mustSeeHTML}
        </ul>
      </div>
    </div>
  `;

  // Attach audio speech handler
  const audioBtn = document.getElementById('btn-play-audio');
  const audioLabel = document.getElementById('audio-btn-label');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      toggleSpeech(narrative, audioLabel);
    });
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Web Speech API Voice Synthesis
function toggleSpeech(text, labelEl) {
  if (!('speechSynthesis' in window)) {
    alert("Sorry, your browser does not support Web Speech API.");
    return;
  }

  if (state.isSpeaking) {
    window.speechSynthesis.cancel();
    state.isSpeaking = false;
    if (labelEl) labelEl.textContent = i18n[state.lang].listenAudio;
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.lang === 'zh_TW' ? 'zh-TW' : 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    state.isSpeaking = true;
    if (labelEl) labelEl.textContent = i18n[state.lang].stopAudio;
  };

  utterance.onend = () => {
    state.isSpeaking = false;
    if (labelEl) labelEl.textContent = i18n[state.lang].listenAudio;
  };

  utterance.onerror = () => {
    state.isSpeaking = false;
    if (labelEl) labelEl.textContent = i18n[state.lang].listenAudio;
  };

  window.speechSynthesis.speak(utterance);
}

function closeModal() {
  if (state.isSpeaking && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    state.isSpeaking = false;
  }
  document.getElementById('detail-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// Update UI Text elements when language switches
function updateUIStrings() {
  const dict = i18n[state.lang];
  document.getElementById('ui-brand-title').textContent = dict.brandTitle;
  document.getElementById('ui-hero-badge').textContent = dict.heroBadge;
  document.getElementById('ui-hero-title').innerHTML = dict.heroTitle;
  document.getElementById('ui-hero-desc').textContent = dict.heroDesc;
  document.getElementById('ui-btn-raw').textContent = dict.btnRaw;
  document.getElementById('ui-stat-1').textContent = dict.statAttractions;
  document.getElementById('ui-stat-2').textContent = dict.statEras;
  document.getElementById('ui-stat-3').textContent = dict.statTimeline;
  document.getElementById('ui-stat-4').textContent = dict.statBilingual;
  document.getElementById('search-input').placeholder = dict.searchPlaceholder;
  document.getElementById('ui-filter-era-label').innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${dict.filterEraLabel}`;
  document.getElementById('ui-filter-cat-label').innerHTML = `<i class="fa-solid fa-shapes"></i> ${dict.filterCatLabel}`;
  document.getElementById('ui-timeline-title').innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${dict.viewTimelineTitle}`;
  document.getElementById('ui-timeline-desc').textContent = dict.viewTimelineDesc;
  document.getElementById('ui-api-title').textContent = dict.apiTitle;
  document.getElementById('ui-api-desc').textContent = dict.apiDesc;
  document.getElementById('ui-footer-desc').textContent = dict.footerDesc;
  document.getElementById('current-lang-label').textContent = state.lang === 'zh_TW' ? 'English' : '繁體中文';
}

// Theme handling
function initTheme() {
  const saved = localStorage.getItem('tg_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
}

// Event Listeners
function setupEventListeners() {
  // Lang Toggle
  document.getElementById('lang-toggle').addEventListener('click', () => {
    state.lang = state.lang === 'zh_TW' ? 'en' : 'zh_TW';
    renderEraPills();
    renderApp();
  });

  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tg_theme', next);
    updateThemeIcon(next);
  });

  // Search input with debounce
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  let debounceTimer;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;
    clearBtn.classList.toggle('hidden', !val);
    debounceTimer = setTimeout(() => {
      state.searchQuery = val;
      renderApp();
    }, 200);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.classList.add('hidden');
    renderApp();
  });

  // Category select
  document.getElementById('category-select').addEventListener('change', (e) => {
    state.selectedCategory = e.target.value;
    renderApp();
  });

  // View toggle buttons
  const gridBtn = document.getElementById('view-grid-btn');
  const timelineBtn = document.getElementById('view-timeline-btn');

  gridBtn.addEventListener('click', () => {
    state.activeView = 'grid';
    gridBtn.classList.add('active');
    timelineBtn.classList.remove('active');
    renderApp();
  });

  timelineBtn.addEventListener('click', () => {
    state.activeView = 'timeline';
    timelineBtn.classList.add('active');
    gridBtn.classList.remove('active');
    renderApp();
  });

  // Modal close handlers
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // API Code Tabs
  const codeSnippets = {
    js: `// Fetch all Taiwan historical attractions
fetch('data/taiwan_attractions.json')
  .then(res => res.json())
  .then(data => {
    console.log(\`Loaded \${data.attractions.length} historical sites\`);
    data.attractions.forEach(spot => {
      console.log(\`[\${spot.eras.join(', ')}] \${spot.name.en} - \${spot.summary.en}\`);
    });
  });`,
    python: `# Python 3 snippet to load Taiwan Guidebook database
import json

with open('data/taiwan_attractions.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

print(f"Total sites: {len(db['attractions'])}")
for spot in db['attractions']:
    print(f"[{spot['established_year'] or 'Unknown'}] {spot['name']['zh_TW']} ({spot['name']['en']})")
`,
    curl: `# cURL to inspect or download the JSON database
curl -s "https://raw.githubusercontent.com/Taiwan-Guidebook/taiwan-guidebook/main/data/taiwan_attractions.json" | jq '.attractions[0]'
`
  };

  const tabBtns = document.querySelectorAll('.api-tabs .tab-btn');
  const codeBlock = document.getElementById('api-code-block');
  const copyBtn = document.getElementById('btn-copy-code');
  const copyText = document.getElementById('copy-text');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      codeBlock.textContent = codeSnippets[tab] || '';
    });
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codeBlock.textContent).then(() => {
      copyText.textContent = i18n[state.lang].copied;
      setTimeout(() => {
        copyText.textContent = i18n[state.lang].copyCode;
      }, 2000);
    });
  });

  // Direct Raw API Data button
  document.getElementById('btn-raw-data').addEventListener('click', (e) => {
    e.preventDefault();
    window.open('../data/taiwan_attractions.json', '_blank');
  });
}
