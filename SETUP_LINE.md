# 📲 LINE 通知後端部署手冊（v4.3 已部署完成 ✅）

> **2026-05-22 已上線**：Cloud Function 部署在 `teachers-ai-assistant-g4iph` 專案，endpoint URL `https://asia-east1-teachers-ai-assistant-g4iph.cloudfunctions.net/notifyLine`，self-test 200 OK，端對端 Flex Card 收到 ✓
>
> 這份手冊保留作為「未來如要遷移專案 / 重新部署 / 換 token」的參考文件。一般使用無需再做任何事。
>
> 4 個觸發已上線：使用者填回饋表、匯出備份、第一次完成 onboarding、發生 JS 錯誤時，阿凱老師 LINE 會自動收到 Flex Card 通知 ✨

---

## 🎯 你會得到的通知範例

| 事件 | 卡片色 | 卡片內容 |
|---|---|---|
| 🆕 使用者填回饋表 | 藍 | 評分 / 身分 / 常用工具 / 卡關 / 期望 |
| ✅ 使用者完成備份 | 綠 | 班級名 / 資料大小 / 工具數 |
| 🎉 新使用者首次完成引導 | 藍 | 班級名 / 頁面 / 裝置 |
| ❌ 前端 JS 錯誤 | 紅 | 錯誤訊息 / 檔案 / 位置 |

每個事件 60 秒內最多 1 條（去重）；後端每分鐘最多接 10 條（rate limit）。

---

## ✅ 前置確認

- [ ] 用 `ipad@mail2.smes.tyc.edu.tw` 登入 Firebase Console
- [ ] 該帳號的 Firebase 專案已升 **Blaze 方案**（後端必須付費才能呼叫外部 API）
- [ ] 已設預算警示：建議 NT$200/月（推 200~600 條通知遠低於此）
- [ ] LINE Bot Channel `2008810864` 還活著（既有的「統一通知 Channel」，無需新建）

如果 Blaze 還沒升：[Firebase Console → Usage and billing → Modify plan → Blaze](https://console.firebase.google.com/project/_/usage/details)

---

## 🛠 部署 5 步驟

### Step 1：選 Firebase 專案

決定要用哪個 Firebase 專案部署這個 Cloud Function。**建議直接共用既有的 `smes-e1dc3`**（你其他專案的 LINE 推播都在這），避免再建一個專案的麻煩。

如果要新建專案：
```bash
# 用 PowerShell 開新視窗（Claude Code Bash 是非互動式無法跑 OAuth）
Start-Process cmd.exe -ArgumentList '/k','firebase login --account ipad@mail2.smes.tyc.edu.tw'
# OAuth 完成後在新視窗繼續：
firebase projects:create coolclass-line-notify --display-name "教室小幫手 LINE 通知"
```

### Step 2：登入 + 連結專案

在 PowerShell 開新視窗（OAuth 用）：
```powershell
Start-Process cmd.exe -ArgumentList '/k','cd /d H:\Coolclass && firebase login --account ipad@mail2.smes.tyc.edu.tw'
```

OAuth 完成後在那個視窗：
```bash
cd /d H:\Coolclass
firebase use --add
# 選 smes-e1dc3（或你新建的專案），alias 設為 default
```

驗證：
```bash
firebase projects:list --account ipad@mail2.smes.tyc.edu.tw
```

### Step 3：設定 LINE 兩個 Secrets

**⚠️ 一定用 Node.js 寫檔再讀**（避免 Windows 上 `printf` / `<<<` 加 `\r\n` 雷）：

```bash
# 1) 設 LINE Channel Access Token
node -e "require('fs').writeFileSync('.tmp_secret', '貼你的 LINE Channel Access Token')"
firebase functions:secrets:set COOLCLASS_LINE_CHANNEL_ACCESS_TOKEN --data-file .tmp_secret
del .tmp_secret

# 2) 設管理員 LINE userId
node -e "require('fs').writeFileSync('.tmp_secret', '貼你的 LINE userId')"
firebase functions:secrets:set COOLCLASS_LINE_ADMIN_USER_ID --data-file .tmp_secret
del .tmp_secret
```

**Token 從哪拿？** 因為這是 ipad@mail2.smes.tyc.edu.tw 個人化的憑證（已在 skill `line-messaging-firebase` 私有檔案中），你可以：
1. 從 LINE Developers Console 重新拿 → Messaging API → Channel access token
2. 或用你既有的 SMES Channel Token（同一個 Channel `2008810864` 共用）

**驗證 secret 沒換行雷（Pre-deploy self-test）**：

```bash
# 從 secret 取出 token + userId
TOKEN=$(firebase functions:secrets:access COOLCLASS_LINE_CHANNEL_ACCESS_TOKEN)
USERID=$(firebase functions:secrets:access COOLCLASS_LINE_ADMIN_USER_ID)

# 直接打 LINE Push API
curl -sS -X POST 'https://api.line.me/v2/bot/message/push' \
  -H 'Content-Type: application/json; charset=utf-8' \
  -H "Authorization: Bearer $TOKEN" \
  --data-raw "{\"to\":\"$USERID\",\"messages\":[{\"type\":\"text\",\"text\":\"教室小幫手 setup test ok\"}]}" \
  -w "\nHTTP_STATUS=%{http_code}\n"
```

期望：`HTTP_STATUS=200` + LINE 收到「教室小幫手 setup test ok」訊息。如果 401 → 重設 token（換行雷）。

### Step 4：部署 Cloud Function

```bash
cd /d H:\Coolclass\functions
npm install
cd ..
firebase deploy --only functions:notifyLine
```

第一次部署若 HTTP 500 失敗（雷 #5），**直接重跑一次**：
```bash
firebase deploy --only functions:notifyLine --force
```

部署成功會回 endpoint URL，類似：
```
✔  functions[notifyLine(asia-east1)] Successful create operation.
Function URL (notifyLine(asia-east1)): https://asia-east1-smes-e1dc3.cloudfunctions.net/notifyLine
```

### Step 5：把 URL 填回前端

打開 `H:\Coolclass\line-notify.js` 第 21 行，把 `ENDPOINT` 改成 Step 4 的 URL：

```js
const ENDPOINT = 'https://asia-east1-smes-e1dc3.cloudfunctions.net/notifyLine';
```

**目前預設值已經是 `smes-e1dc3`**，如果你直接共用該專案，**不用改任何東西** ✨

然後 commit + push：
```bash
cd /d H:\Coolclass
git add -A
git commit -m "feat(line): 啟用 LINE 通知整合"
git push origin main
```

---

## 🧪 部署完驗證

### Test A：endpoint 健康檢查
```bash
curl -sS https://asia-east1-smes-e1dc3.cloudfunctions.net/notifyLineHealth
# 期望：{"ok":true,"ts":1234567890}
```

### Test B：手動推一條 LINE 試試

```bash
curl -sS -X POST 'https://asia-east1-smes-e1dc3.cloudfunctions.net/notifyLine' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "event": "feedback_submitted",
    "payload": {
      "stars": 5,
      "role": "elementary",
      "favs": "情緒打卡、跑馬燈",
      "pain": "希望加 LINE 通知",
      "wish": "更多體適能項目",
      "email": "test@example.com"
    }
  }'

# 期望：{"ok":true} + LINE 收到藍色卡片
```

### Test C：實際操作 PWA 驗證
1. 開 https://cagoooo.github.io/coolclass/feedback.html
2. 填表 → 送出
3. LINE 應收到「🆕 收到使用者回饋」Flex Card

---

## 🔧 微調與管理

### 暫時關閉通知（單一裝置）
在 PWA console 跑：
```js
window.AkaiNotifyLineConfig.disable();   // 關
window.AkaiNotifyLineConfig.enable();    // 開
```

### 完全停用（給 fork 出去的老師）
編輯 `line-notify.js` 第 21 行：
```js
const ENDPOINT = '';  // 空字串 = 全站不送
```

### 看 Cloud Function log
```bash
firebase functions:log --only notifyLine --lines 30
```

### Secret 過期 / 重置
```bash
# 重設 token
node -e "require('fs').writeFileSync('.tmp_secret', '新的 token')"
firebase functions:secrets:set COOLCLASS_LINE_CHANNEL_ACCESS_TOKEN --data-file .tmp_secret
del .tmp_secret
firebase deploy --only functions:notifyLine
```

### Rate limit / 訊息洗版時
打開 `functions/index.js` 第 173 行調整：
```js
if (rateLog.length >= 10) return false;  // 改成你想要的閾值
```

---

## 💰 費用預估（校用情境）

| 項目 | 月用量 | 費用 |
|---|---|---|
| Cloud Function 呼叫 | ~500 次（50 老師 × 平均 10 事件）| $0（免費額度 200 萬次）|
| LINE 推播 | ~500 條 | $0（前 500 條免費）|
| **總月費** | | **$0** |

只要使用者人數沒爆炸（< 200 老師），都在免費額度內。如果 LINE 推播超過 500 條/月，會跳到 LINE 加值方案。

---

## 🛡 安全注意事項

- ❌ **絕對不要** 把 LINE Token 寫進 `line-notify.js`（前端 = 公開）
- ✅ Token 只放在 Firebase Secret Manager（後端讀，永不離開 server）
- ✅ Cloud Function `cors: true` + `maxInstances: 5` 控制濫用
- ⚠️ 目前 endpoint 是 public（任何人都能 POST），但有 rate limit 防洗版
- 🚀 如果未來流量大想加 Cloudflare Turnstile 防 bot，見 skill `cloudflare-turnstile-integration`

---

## 📋 已實作的 4 個觸發點

| 觸發 | 位置 | 條件 |
|---|---|---|
| `feedback_submitted` | feedback.html 送出時 | 每次 |
| `backup_exported` | backup.html exportAll() 成功時 | 每次 |
| `first_install` | onboarding.js 完成 + 設好 `akai_first_install_notified_v1` | 每裝置 1 次 |
| `js_error` | 全頁 window.error + unhandledrejection | 每 session 同錯誤 1 次 |

如果要新增其他觸發點：在任何 HTML / JS 內呼叫：
```js
if (window.AkaiNotifyLine) {
  window.AkaiNotifyLine('event_name', { key1: 'value1', key2: 'value2' });
}
```

新事件型別記得到 `functions/index.js` 的 `buildCardFromEvent` 加上 case。

---

## 🔧 完成後 commit 紀錄

部署完後，建議 commit 一次：
```bash
cd /d H:\Coolclass
git add line-notify.js
git commit -m "chore(line): 填入 Cloud Function endpoint URL"
git push origin main
```

完成後告訴 Claude「LINE 已部署」，Claude 會把 PROGRESS.md 跟 CHANGELOG.md 補上「v4.2 LINE 通知正式啟用 ✅」並提示驗證下一步。

---

Made with ❤️ by 阿凱老師（[桃園市龍潭區石門國民小學](https://www.smes.tyc.edu.tw/modules/tadnews/page.php?ncsn=11&nsn=16#a5)）
