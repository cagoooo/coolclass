<div align="center">

# 🌈 教室小幫手

### 老師的每日課堂工具 · 8 個免費小工具

[![Live](https://img.shields.io/badge/🌐_線上版-cagoooo.github.io%2Fcoolclass-2a1f4a?style=for-the-badge)](https://cagoooo.github.io/coolclass/)
[![PWA](https://img.shields.io/badge/📲_可裝成_App-PWA-ffd23f?style=for-the-badge&labelColor=2a1f4a)](https://cagoooo.github.io/coolclass/)
[![License](https://img.shields.io/badge/MIT-開源自由用-6bcb77?style=for-the-badge&labelColor=2a1f4a)](LICENSE)

![教室小幫手 — 老師的每日課堂工具](og-image.png)

**✨ 免登入 · 🔒 不上傳 · 📲 可離線 · 🆓 永久免費 · 🎨 v3 Crayon Pop 設計風格**

</div>

---

## 🎯 給誰用？

**所有國中小、高中、補教、安親班老師**。
打開瀏覽器或裝成 App 就能用，**所有資料只存在你電腦的瀏覽器裡，不會被傳到任何雲端**。

| 場景 | 用得到的工具 |
|---|---|
| 🌅 **晨間活動** | 😊 情緒打卡 + 🌈 今日能量卡 |
| 📚 **上課中** | 🎯 隨機抽號 + ⏱️ 計時器 + 👥 分組 |
| 📋 **班務管理** | 📝 班級 To-Do + 📋 出勤記錄 |
| 📢 **大屏投影** | 📢 跑馬燈通知（含時鐘 + 倒數） |
| 📊 **月底交差** | 出勤表一鍵匯出 CSV / 列印 PDF |

---

## 🧰 8 大工具一覽

<table>
<tr>
<td width="50%">

### 😊 情緒打卡牆
1-N 號學生 × 5 種情緒（開心 / 生氣 / 難過 / 緊張 / 平靜），三步驟貼牆。**每天都能用、晨間活動必備**。

[**🌐 打開**](https://cagoooo.github.io/coolclass/emotion.html)

</td>
<td width="50%">

### 📝 班級 To-Do List
紅 / 黃 / 綠三欄拖曳，**自動存檔**、可匯出 JSON 備份。班級事務、值日生工作板都好用。

[**🌐 打開**](https://cagoooo.github.io/coolclass/todo.html)

</td>
</tr>
<tr>
<td width="50%">

### 🌈 彩虹能量卡
**103 句阿德勒風小語**，「今日心錨」每天固定一張，可收藏到能量牆。教師自我激勵、晨間會議暖場。

[**🌐 打開**](https://cagoooo.github.io/coolclass/cards.html)

</td>
<td width="50%">

### 📋 學生出勤記錄表
自動扣週末、點格子切換 4 種狀態（出席 / 遲到 / 請假 / 缺席）、**PDF + CSV 雙匯出**。月底交教務處超快。

[**🌐 打開**](https://cagoooo.github.io/coolclass/attendance.html)

</td>
</tr>
<tr>
<td width="50%">

### 📢 跑馬燈通知
8 種主題色 + 大字幕，**內建時鐘 + 倒數計時**。投影機顯示「明天記得帶水彩」「離下課還 5 分鐘」。

[**🌐 打開**](https://cagoooo.github.io/coolclass/marquee.html)

</td>
<td width="50%">

### 🎯 隨機抽號
大字幕轉盤動畫 + 抽中音效，**公平模式**自動排除已抽過的。誰來答題讓老天爺決定。

[**🌐 打開**](https://cagoooo.github.io/coolclass/picker.html)

</td>
</tr>
<tr>
<td width="50%">

### ⏱️ 教室計時器
大字幕倒數 + 8 個預設時間 + 自訂分秒、**最後 30 秒警示色 + 結束鈴聲**。討論 / 考試 / 休息都好用。

[**🌐 打開**](https://cagoooo.github.io/coolclass/timer.html)

</td>
<td width="50%">

### 👥 隨機分組
洗牌分 N 組 / 每組 N 人、**自動選組長 👑**、10 色彩配對。可印 A4 名牌、可複製文字版到 LINE 群。

[**🌐 打開**](https://cagoooo.github.io/coolclass/grouper.html)

</td>
</tr>
</table>

---

## 🚀 三種使用方式

### 方式 1：直接打開網頁（最快）
1. 瀏覽器點 https://cagoooo.github.io/coolclass/
2. 第一次會跳出 5 卡 onboarding 引導
3. 點「👥 班級名單設定」輸入班級和學生姓名（Excel 一欄複製貼上也行）
4. 開始用！

### 方式 2：裝成 App（推薦・離線可用）

| 裝置 | 怎麼裝 |
|---|---|
| **Chrome / Edge** | 網址列右邊「安裝」圖示 → 點一下 |
| **iPhone Safari** | 分享 → 加入主畫面 |
| **Android Chrome** | 選單 → 加到主畫面 |

裝完後：
- 主畫面有可愛的笑臉彩虹 icon
- 開啟比網頁快很多
- **沒網路也能開**（戶外教學、機房沒網都不怕）

### 方式 3：fork 改成自己學校版本

```bash
git clone https://github.com/cagoooo/coolclass.git my-school-tools
cd my-school-tools
# 改 footer 改顏色 改文案 加你想要的功能
bash bump-version.sh "改了什麼"
git push  # 推到你的 GitHub 就會自動部署
```

MIT License — 自由使用、修改、再散佈，不需要徵詢同意。

---

## ⌨️ 鍵盤快捷鍵

| 工具 | 快捷鍵 |
|---|---|
| 🎯 抽號 | **空白鍵** = 抽 |
| ⏱️ 計時器 | **空白鍵** = 開始/暫停、**R** = 重設、**F** = 全螢幕、**Esc** = 離開全螢幕 |
| 📢 跑馬燈 | **空白鍵** = 暫停、**Esc** = 離開全螢幕 |

---

## 🎨 v3 Crayon Pop 設計

v3 改版（2026-05）採用**深紫墨色 + 暖奶油底 + 飽和原色 + 粗黑邊 + 偏移實心投影**的童趣風格。

**內建視覺微調面板**（每頁右下角 🎨）：
- 🌈 主色切換：彩虹 / 薄荷 / 日落 / 莓果 / 海洋
- 🌙 深色模式
- ✨ 背景裝飾開關
- 📐 扁平模式（移除所有投影）
- 🔍 字級調整 90%-120%

---

## 🔔 自動更新通知

- 你改完程式 push 上來，**已開啟網頁的老師 3 分鐘內**右下角會跳粉紅 banner「🌈 有新版本了！」
- 按「立刻更新」自動清快取 + reload，直接吃到新版
- **不需要請使用者按 Ctrl+Shift+R**

技術：BUILD_VERSION 占位字串 + Service Worker network-first + version.json polling。

---

## 💾 資料保存與隱私

- 全部資料存在你瀏覽器的 `localStorage`，**不會傳到任何伺服器**
- **同一台電腦同一個瀏覽器**才看得到記錄
- 換電腦 / 清快取 / 無痕視窗 → 舊資料不會帶過去
- 建議每月「匯出 CSV + 列印 PDF」備份一次

---

## 🛠️ 技術設計（給想 fork 的老師）

- 純 HTML / CSS / vanilla JS — **無建構流程、無框架、無外部依賴**（僅 Google Fonts）
- localStorage 統一 `akai_*_v1` 命名空間（要改名請全 repo replace）
- Service Worker network-first，BUILD_VERSION 占位確保更新一定被偵測
- 響應式設計，手機 / 平板 / 桌機 / 觸控大屏都能用
- 所有頁面都有「← 回主頁」按鈕
- 部署：GitHub Pages（推 main branch 自動上線）

### 檔案結構

```
coolclass/
├── index.html           # 首頁儀表板
├── roster.html          # 班級名單設定（必先設定）
├── emotion.html         # 情緒打卡牆
├── todo.html            # 班級 To-Do List
├── cards.html           # 彩虹能量卡
├── attendance.html      # 學生出勤記錄表
├── marquee.html         # 跑馬燈通知
├── picker.html          # 隨機抽號
├── timer.html           # 教室計時器
├── grouper.html         # 隨機分組
├── crayon.css           # v3 設計系統（1100 行）
├── roster.js            # 共用班級名單模組
├── tweaks.js            # 視覺微調面板
├── onboarding.js        # 首次使用引導
├── attendance.js        # 出勤頁邏輯
├── sw.js                # Service Worker
├── sw-update.js         # 更新通知雙線偵測
├── manifest.json        # PWA manifest
├── icon.svg             # App icon
├── og-image.png         # 社群分享預覽圖
├── og-generator.html    # OG 圖產生器（自己改了 logo / 文案後重新產）
├── version.json         # 版本號（自動產生）
├── bump-version.sh      # 升版腳本
├── README.md
├── SHARE.md             # 教師社群分享文範本
└── LICENSE
```

---

## 📢 推廣與分享

想推薦給其他老師？這邊有現成的分享文範本 → **[SHARE.md](SHARE.md)**

包含：
- 📱 LINE 群組短訊版
- 📘 Facebook 教師社群長文版
- 🗣️ 學校晨會口頭簡介版

---

## 🗺️ 之後想做什麼

✅ **已上線** v1.0 → v2.0 → v3.0 Crayon Pop（含 PWA + 自動更新通知 + Tweaks + Onboarding）

🌱 **準備做** 抽號分組抽 · 計時器多計時器並行 · 能量卡下載成圖 · 情緒打卡歷史趨勢頁

🌳 **規劃中** 一鍵全資料備份 · 每月班級報告 PDF · 班級積點榜 · 上下課鈴聲

---

## License

MIT — 自由使用、修改、再散佈，**不需要徵詢同意**。
若你做出新版本給你們學校用，歡迎讓我知道（不強制） 🤝

---

<div align="center">

Made with ❤️ by [**阿凱老師**](https://www.smes.tyc.edu.tw/modules/tadnews/page.php?ncsn=11&nsn=16#a5)
桃園市龍潭區石門國民小學

</div>
