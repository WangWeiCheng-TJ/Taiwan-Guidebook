# 🇹🇼 臺灣景點歷史沿革與文化旅遊資料庫 (Taiwan Historical & Cultural Guidebook DB)

> **An open-standard bilingual (Traditional Chinese & English) cultural and historical database for Taiwan attractions, designed for international travelers, web/app developers, and cultural researchers.**
> 
> 專為國際旅客、網站與 App 開發者打造的臺灣歷史名勝開放資料庫。以「**歷史年代分期、歷史沿革演進、建築工藝看點、文化意涵與外國人參訪禮儀**」為核心，並內建 **Google Gemini API 自動採集考證工具** 與 **現代化互動式 Web 預覽器**。

---

## ✨ 核心特色 (Key Features)

- 🏛️ **四百年歷史脈絡分期**：嚴格標註景點經歷之歷史時期（史前/原住民、荷西時期 1624–1662、明鄭時期 1661–1683、清領時期 1683–1895、日治時期 1895–1945、戰後與當代 1945–迄今）。
- 🌏 **高品質中英雙語 (100% Bilingual)**：專為外國朋友視角撰寫之歷史沿革、文化意義與參訪禮儀（避免常見的生硬機翻）。
- ⏱️ **結構化歷史時間軸 (Chronological Timeline)**：每個景點皆附結構化重大歷史事件年份陣列，方便 App 繪製互動時間軸。
- 🤖 **Gemini API AI 自動資料撈取工具**：只要輸入景點名稱（如「淡水紅毛城」、「台南孔廟」、「霧峰林家」），AI 即自動依照嚴格 Schema 進行歷史考證、雙語生成並寫入資料庫。
- 💻 **現代化互動 Web 預覽器**：內建暗黑美學介面、朝代篩選、即時搜尋、總時間軸檢視、語音導覽 (Web Speech API) 與 API 代碼產生器。
- 📦 **API & App Ready**：採用標準 JSON Schema，可直接透過 GitHub Raw、CDN、iOS / Android App 或前端框架無縫介接。

---

## 📁 專案目錄結構 (Project Structure)

```
Taiwan-Guidebook/
├── .gitignore
├── .env.example                   # Gemini API 金鑰範本
├── README.md                      # 專案說明與開發者文件
├── schema/
│   └── attraction.schema.json     # JSON Schema 嚴格規範定義
├── data/
│   ├── attractions/               # 獨立景點 JSON 檔案庫
│   │   ├── fort-san-domingo.json          # 淡水紅毛城
│   │   ├── chihkan-tower.json             # 台南赤崁樓
│   │   ├── tainan-confucius-temple.json   # 臺南孔廟 (全臺首學)
│   │   ├── lukang-longshan-temple.json    # 鹿港龍山寺
│   │   ├── jiufen-gold-mountain.json      # 九份與金瓜石礦業遺址
│   │   └── dadaocheng-dihua-street.json   # 大稻埕迪化街歷史街區
│   └── taiwan_attractions.json    # 整合發布檔 (供前端/App 一次載入)
├── scripts/
│   ├── generate_spot.py           # 🚀 Gemini API 自動化景點生成 CLI 工具
│   ├── build_dataset.py           # 🔄 資料庫編譯、Schema 驗證與同步工具
│   ├── sample_spots.txt           # 批次推薦景點清單範本
│   └── requirements.txt           # 輔助 Python 依賴
└── web/                           # 🌐 互動式 Web 探索預覽器
    ├── index.html                 # 現代化展示首頁
    ├── style.css                  # 視覺設計與暗黑主題樣式
    ├── app.js                     # 雙語切換、篩選、語音導覽與搜尋邏輯
    └── taiwan_attractions.json    # Web 端同步靜態快照
```

---

## 🚀 快速開始 (Quick Start)

### 1. 檢視 Web 預覽器
您可直接在瀏覽器開啟 `web/index.html`，或使用任何靜態伺服器啟動：
```bash
# 使用 Python 內建伺服器啟動 Web 介面
python -m http.server 8000 --directory web
# 開啟瀏覽器訪問 http://localhost:8000
```

---

## 🤖 使用 Gemini API 自動撈取與建檔景點

您不需要手動撰寫龐大的歷史資料與英文翻譯，本專案提供 `generate_spot.py` 自動化工具：

### 步驟 1：取得免費 Gemini API Key
至 [Google AI Studio](https://aistudio.google.com/app/apikey) 免費申請 API Key。

### 步驟 2：設定 API Key
複製 `.env.example` 為 `.env` 並填入金鑰：
```bash
# 建立 .env 檔案
cp .env.example .env
```
在 `.env` 中寫入：
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
*(或在 PowerShell 執行 `$env:GEMINI_API_KEY="your_api_key"`)*

### 步驟 3：執行自動產生腳本

#### 方式 A：輸入單一景點名稱
```bash
python scripts/generate_spot.py "安平古堡"
```
腳本會自動：
1. 呼叫 Gemini 模型進行臺灣歷史考證。
2. 產出符合規範之中英雙語 JSON 檔至 `data/attractions/anping-fort.json`。
3. 自動觸發 `build_dataset.py` 更新 `data/taiwan_attractions.json` 與 `web/`。

#### 方式 B：互動終端機模式 (連續輸入)
```bash
python scripts/generate_spot.py --interactive
```

#### 方式 C：批次清單讀取 (一鍵產生多個景點)
```bash
python scripts/generate_spot.py --file scripts/sample_spots.txt
```

---

## 🔄 手動驗證與重新編譯資料庫

如果您手動修改了 `data/attractions/` 內的 JSON，可隨時執行編譯腳本：
```bash
python scripts/build_dataset.py
```
此腳本會驗證所有資料格式是否正確，並將資料匯總輸出至 `data/taiwan_attractions.json`。

---

## 📊 資料格式規範 (Schema Overview)

每個景點 JSON 檔案皆包含以下結構化欄位：

| 欄位 (Key) | 型態 (Type) | 說明 (Description) |
|---|---|---|
| `id` | `string` | 唯一英文章節標識 (kebab-case, 如 `fort-san-domingo`) |
| `name` | `object` | `{ zh_TW: "淡水紅毛城", en: "Fort San Domingo" }` |
| `location` | `object` | 縣市、行政區、中英地址與精確 GPS 座標 (`lat`, `lng`) |
| `category` | `string` | 景點類別 (要塞堡壘、古剎寺廟、歷史街區、工業遺產等) |
| `eras` | `array` | 橫跨之歷史朝代陣列 (荷西、明鄭、清領、日治、戰後等) |
| `established_year`| `integer` | 創建或起造西元年份 (如 `1628`) |
| `heritage_status` | `string` | 法定文資身分 (如 `國定古蹟 / National Historic Monument`) |
| `summary` | `object` | 2-3 句中英精準核心特色摘要 |
| `historical_narrative` | `object` | 深入考證的歷史沿革演進脈絡（中英雙語） |
| `timeline` | `array` | 重大紀年時間軸 `[{ year_or_era, era_category, event_zh, event_en }]` |
| `cultural_significance` | `object` | 歷史重要性、建築結構看點、無形民俗文化 |
| `foreign_visitor_guide` | `object` | 外國人文化禮儀 (寺廟規矩/門檻禁忌)、必看重點、交通指南 |
| `tags` | `array` | 主題標籤陣列 |

---

## 💻 開發者介接範例 (Developer API Integration)

### 1. JavaScript (Web / Node.js)
```javascript
// 透過 fetch 讀取所有景點資料
fetch('https://raw.githubusercontent.com/WangWeiCheng-TJ/Taiwan-Guidebook/main/data/taiwan_attractions.json')
  .then(response => response.json())
  .then(data => {
    console.log(`已成功載入 ${data.attractions.length} 處臺灣歷史名勝`);
    data.attractions.forEach(spot => {
      console.log(`[${spot.eras.join(', ')}] ${spot.name.en} (${spot.location.city_en})`);
    });
  });
```

### 2. Python
```python
import json
import urllib.request

url = "https://raw.githubusercontent.com/WangWeiCheng-TJ/Taiwan-Guidebook/main/data/taiwan_attractions.json"
with urllib.request.urlopen(url) as response:
    db = json.loads(response.read().decode('utf-8'))

for spot in db["attractions"]:
    print(f"📍 {spot['name']['zh_TW']} ({spot['name']['en']}) - 建於 {spot['established_year']} 年")
```

---

## 🚢 Git 推送至 GitHub 指南 (Push to GitHub)

若要將此專案推送到您自己的 GitHub Repository，請依照以下步驟：

```bash
# 1. 在 GitHub 上建立一個新的 Repository (例如: Taiwan-Guidebook)

# 2. 設定遠端庫網址
git remote add origin https://github.com/WangWeiCheng-TJ/Taiwan-Guidebook.git

# 3. 命名主分支為 main
git branch -M main

# 4. 推送至 GitHub
git push -u origin main
```

---

## 📜 開放授權 (License)

- 資料內容：採用 **Creative Commons Attribution 4.0 International (CC-BY 4.0)** 授權釋出。
- 程式碼工具與 Web 預覽器：採用 **MIT License** 開源釋出。
