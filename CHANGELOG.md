# Changelog · 教室小幫手

> 所有重大變更會記錄在這個檔案。
> 格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，
> 版本號採 [語意化版本（Semantic Versioning）](https://semver.org/lang/zh-TW/) 的精神。
> 永久線上版：<https://cagoooo.github.io/coolclass/>

---

## [3.7.0] · 2026-05-21 · 全頁導航 FAB

### Added
- 🧭 **工具導航 FAB**：所有 30 個頁面右下角新增「🧭 工具導航」浮動按鈕，點開展示 26 工具分類面板（含搜尋框）。一鍵跳到任何工具，**不用回首頁再點**。
- ⬆ **回到頂部 FAB**：捲動超過 300px 時右下角浮現「⬆ 回頂部」按鈕，點一下平滑滾回頁首。
- 🆕 **`nav.js`** 通用模組：與 `tweaks.js` / `sw-update.js` 同款一鍵注入；含 ESC 關閉、點外圍關閉、列印自動隱藏、手機 RWD 縮小尺寸、目前頁自動標記「目前」chip。

### Changed
- 📝 30 個 HTML 全部注入 `<script src="nav.js" defer></script>`
- 📦 `sw.js` CORE_ASSETS 加入 `nav.js`

---

## [3.6.0] · 2026-05-21 · 推廣升級包

### Added
- 🆕 **跑馬燈「自動讀今日重點」一鍵按鈕**：自動讀取今日能量卡引言、生日壽星、情緒打卡統計、未完成待辦、本月行為觀察、積點榜冠軍，產生 3〜7 則跑馬燈訊息。深度整合 6 個工具的資料。
- 🆕 **30 天備份提醒**：sw-update.js 內建被動偵測，若 30 天未備份且確有資料，右下角會跳粉紅提醒 banner。可設「14 天先別煩我」。`backup.html` 匯出 / 複製成功後自動標記時間戳。
- 🆕 **CHANGELOG.md**（本檔案）：完整版本歷史紀錄。
- 🆕 **README 重寫**：26 工具完整列表、嵌入截圖、新功能說明。

### Changed
- 📝 `backup.html` 匯出與複製到剪貼簿後自動呼叫 `window.AkaiMarkBackup()` 更新最後備份時間。

---

## [3.5.0] · 2026-05-21 · Phase J 老師日常 9 工具

### Added — 9 個全新工具，總數達 **26**

| 工具 | 檔案 | 一句話介紹 |
|---|---|---|
| 🪑 **座位表** | `seating.html` | 拖曳排座位、列印 A4、可儲存多套 |
| 📅 **課表** | `schedule.html` | 一週課表、列印給家長 |
| 🎂 **生日榜** | `birthday.html` | 月曆顯示壽星、可一鍵推到跑馬燈 |
| 🍱 **午餐點餐** | `lunch.html` | 主餐選單統計 + 不吃豬牛海鮮過敏標記 |
| 📞 **親師溝通記錄** | `contact.html` | 通聯時間、主題、家長意見、處理結果 |
| 🎯 **行為觀察記錄** | `behavior.html` | 正向 / 提醒紀錄、月度統計、可給家長簽 |
| 📋 **代課老師交接單** | `substitute.html` | 一日交接：課表 / 提醒 / 重點學生 |
| 🎒 **戶外教學助手** | `field-trip.html` | 點名清單 + 緊急聯絡 + 集合提醒 |
| 📚 **教案備忘** | `lesson.html` | 教學流程 / 教具 / 評量、可複製到 Word |

---

## [3.4.0] · 2026-05 · Phase I 教室生態 3 工具

### Added
- 🎲 **`lottery.html` 萬用抽籤箱**：任意名單抽籤，公平模式、抽完不重複。
- 📜 **`rules.html` 班級公約展示**：大字幕展示、可投影、可印 A3。
- 🖼️ **`gallery.html` 學生作品牆**：IndexedDB 存圖避免 localStorage 大小限制，網格瀏覽。

---

## [3.3.0] · 2026-05 · 學生視角工具

### Added
- 🧒 **`emotion-kiosk.html` 學生 kiosk 打卡**：班上學生自己點打卡，老師端同步看到。
- 📱 **`qr.html` QR Code 工具**：產生連結 QR Code（用 api.qrserver.com）。
- 🎓 **`student.html` 學生個人成長報告**：單一學生跨工具資料聚合。
- 💰 **`finance.html` 班費記帳**：收支記錄、月結。
- 🔊 **抽號語音播報**（picker.html）：抽中後唸出號碼或姓名。
- 🔗 **G1 整合**：缺席學生在情緒打卡頁顯示「請假 / 缺席」狀態。
- 🔗 **G2 整合**：picker 抽中後可一鍵 +1 積點到 points.html。

---

## [3.2.0] · 2026-04 · RWD 全面響應式

### Changed
- 📱 **A1〜A8 全部 17 個工具完成 RWD 適配**：手機 / 平板 / 桌機 / 觸控大屏皆可用。
- 🎨 **能量卡 4 項 UX 改良**（B1-B4）：複製引言、長句自動縮字、抽卡歷史 ←→、收藏粒子動畫。

### Fixed
- 🐛 **抽卡仍卡在卡背的 root cause**：Chrome 對特定元素組合的 rotateY 渲染失效。改用 `@keyframes opacity` 淡入淡出取代 3D 翻轉，穩定可靠。
- 🐛 **抽卡點了沒反應**：transition 失效偵測 + 改寫。

---

## [3.1.x] · 2026-04 · Crayon Pop 修補 + 推廣準備

### Added
- 📦 **`backup.html`** 一鍵全資料備份 / 還原（v3.1）
- 📊 **`report.html`** 每月班級報告
- 🏆 **`points.html`** 班級積點榜
- 🔔 **`bell.html`** 上下課鈴聲（多時段、可關閉）
- 📷 **`og-image.png`** 社群分享預覽圖（透過 Claude Preview + canvas 自動產生）
- 📝 **README 截圖陣列 + Demo gallery**
- 📢 **`SHARE.md`** 教師社群分享文範本（LINE / Facebook / 晨會口頭三版）
- ⏱️ **計時器多計時器並行**（最多 4 個）
- 💾 **能量卡下載成圖**（canvas.toDataURL）
- 📈 **`emotion-history.html`** 情緒打卡歷史趨勢頁

---

## [3.0.0] · 2026-04 · Crayon Pop 設計大改版

### Changed
- 🎨 **採用 Crayon Pop 設計系統**：深紫墨色（#2a1f4a）+ 暖奶油底（#fff8e8）+ 飽和原色 + 粗黑邊 + 偏移實心投影。
- 🎨 **`crayon.css`** 1100+ 行設計系統，**所有工具統一視覺語言**。
- 🛠 **`tweaks.js`** 視覺微調面板：5 種主色、深色模式、扁平模式、字級調整。
- 📖 **`onboarding.js`** 首次使用 5 卡引導。
- 🖼️ **`icon.svg`** 笑臉彩虹 App icon。
- 🏫 **移除阿凱老師個人色彩**（除 footer 署名），改為通用工具，所有老師都能用。

### Fixed
- 🐛 Onboarding skip 按鈕與 5 顆進度圓點重疊 → 加 `padding-right: 76px`。

---

## [2.0.0] · 2026-03 · PWA + 自動更新

### Added
- 📲 **PWA 可裝成 App**：manifest.json + sw.js + icon。Chrome / Edge / iOS Safari / Android Chrome 都能裝。
- 🎯 **`picker.html` 隨機抽號**：大字幕轉盤、抽中音效、公平模式。
- ⏱️ **`timer.html` 教室計時器**：8 預設、最後 30 秒警示、結束鈴聲。
- 👥 **`grouper.html` 隨機分組**：洗牌、自動選組長 👑、10 色配對、A4 名牌列印。
- 🏠 **`index.html` 首頁儀表板**：所有工具入口。
- 🔔 **自動更新通知系統**：
  - `sw.js` BUILD_VERSION 占位 + postMessage SW_ACTIVATED
  - `sw-update.js` 雙線偵測（SW lifecycle + version.json 3 分鐘輪詢）+ 粉紅 banner
  - `version.json` + `bump-version.sh` 每次部署自動升版
  - 老師按「立刻更新」自動清快取 + reload
- 👥 **`roster.js` + `roster.html` 共用班級名單模組**：所有工具共用一份名單。
- 📅 **每日今日能量卡**：每天固定一張作為「今日心錨」。
- 🕐 **跑馬燈時鐘 + 倒數**：投影時可顯示。

### Changed
- 🌐 所有 HTML `<title>` 改通用、移除學校資訊（推廣到其他老師）。
- 📝 `marquee.html` 預設訊息改通用。
- 🌈 `cards.html` 類別名改通用。

---

## [1.0.0] · 2026-03 · 初版 5 工具

### Added — 第一批 5 工具
- 😊 **`emotion.html` 情緒打卡牆**：1-N 號學生 × 5 種情緒，三步驟貼牆。
- 📝 **`todo.html` 班級 To-Do List**：紅 / 黃 / 綠三欄拖曳、自動存檔、JSON 匯出。
- 🌈 **`cards.html` 彩虹能量卡**：103 句阿德勒風小語、可收藏到能量牆。
- 📋 **`attendance.html` 學生出勤記錄表**：自動扣週末、4 種狀態、PDF + CSV 雙匯出。
- 📢 **`marquee.html` 跑馬燈通知**：8 種主題色、大字幕。
- 🚀 **GitHub Pages 部署**：永久線上版 <https://cagoooo.github.io/coolclass/>

---

## 設計與技術原則

- **純 HTML / CSS / vanilla JS** — 無建構流程、無框架、無外部依賴（僅 Google Fonts）
- **localStorage 統一 `akai_*_v1` 命名空間**
- **Service Worker network-first**，BUILD_VERSION 占位確保更新一定被偵測
- **響應式設計**，手機 / 平板 / 桌機 / 觸控大屏都能用
- **MIT License** — 自由使用、修改、再散佈

---

Made with ❤️ by 阿凱老師（[桃園市龍潭區石門國民小學](https://www.smes.tyc.edu.tw/modules/tadnews/page.php?ncsn=11&nsn=16#a5)）
