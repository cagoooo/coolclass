/**
 * 教室小幫手｜LINE 通知 Cloud Function
 *
 * 接收前端 POST /notifyLine，把事件推到 Google Chat；只有錯誤（js_error）才另外推 LINE。
 *
 * 2026-11-18 起：多個網站共用同一個 LINE 官方帳號（免費方案每月 200 則），
 * 回饋、備份、首次安裝、第一次用工具這類一般事件只發 Google Chat，LINE 留給錯誤告警。
 *
 * Secrets (用 firebase functions:secrets:set 設定)：
 *   COOLCLASS_LINE_CHANNEL_ACCESS_TOKEN  ← LINE long-lived token
 *   COOLCLASS_LINE_ADMIN_USER_ID         ← 阿凱老師個人 LINE userId
 *   GOOGLE_CHAT_WEBHOOK_URL              ← Google Chat 空間 Webhook（與同專案其他函式共用）
 *
 * 2026-11-23 起：每個事件都另外寫進 Firestore（(default) 資料庫，集合一律 coolclass_ 前綴，
 * 不碰同專案 Message 應用的資料），Chat 只是通知、資料庫才是帳冊：
 *   coolclass_events/{自動}      每一筆事件（含 tool_open 工具開啟統計）
 *   coolclass_feedback/{自動}    回饋表單完整內容（含 Email，只有後台看得到）
 *   coolclass_devices/{裝置代號}  每台裝置第一次／最後一次出現、用過哪些工具
 *   coolclass_daily/{YYYY-MM-DD} 每天（台北時間）的事件數、工具開啟數、活躍裝置
 * 前端不能直接讀寫這些集合（未登入讀寫已實測 403），只有本函式用 Admin SDK 寫入。
 *
 * 部署（同專案有別的應用的函式，一律點名部署，不要整包 --only functions）：
 *   firebase deploy --only functions:notifyLine,functions:notifyLineHealth
 *
 * 前端呼叫：
 *   await fetch('https://asia-east1-<PROJECT>.cloudfunctions.net/notifyLine', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ event: 'feedback_submitted', payload: { ... } })
 *   });
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
// Firestore 套件很大，等第一次真的要寫入才載入（部署分析時才不會逾時）
let _fs = null;
function fsMod() {
  if (!_fs) {
    const { initializeApp, getApps } = require('firebase-admin/app');
    const firestore = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp();
    _fs = { db: firestore.getFirestore(), FieldValue: firestore.FieldValue };
  }
  return _fs;
}

const LINE_TOKEN = defineSecret('COOLCLASS_LINE_CHANNEL_ACCESS_TOKEN');
const LINE_USER  = defineSecret('COOLCLASS_LINE_ADMIN_USER_ID');
const GOOGLE_CHAT_WEBHOOK = defineSecret('GOOGLE_CHAT_WEBHOOK_URL');

const APP_NAME = '教室小幫手';

const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';

// ===== Flex Card 主題（依 line-messaging-firebase skill v2 規範）=====
const CARD_THEMES = {
  started: { headerBg: '#1E40AF', headerSubColor: '#BFDBFE', icon: '🆕' },
  success: { headerBg: '#065F46', headerSubColor: '#A7F3D0', icon: '✅' },
  failed:  { headerBg: '#991B1B', headerSubColor: '#FECACA', icon: '❌' },
  warning: { headerBg: '#92400E', headerSubColor: '#FDE68A', icon: '⚠️' },
};

// ===== 事件對應卡片設定 =====
function buildCardFromEvent(event, payload) {
  payload = payload || {};
  const ua = (payload._ua || '').substring(0, 60);
  const url = (payload._url || '').substring(0, 80);
  const baseFields = [];
  if (payload._classname) baseFields.push({ icon: '🏫', label: '班級', value: String(payload._classname).substring(0, 30) });

  switch (event) {

    case 'feedback_submitted':
      return {
        status: 'started',
        title: '收到使用者回饋',
        appName: '教室小幫手',
        fields: [
          { icon: '⭐', label: '評分', value: '★'.repeat(payload.stars || 0) + '☆'.repeat(5 - (payload.stars || 0)) },
          { icon: '👤', label: '身分', value: String(ROLE_MAP[payload.role] || payload.role || '未填').substring(0, 30) },
          { icon: '💝', label: '常用', value: String(payload.favs || '無').substring(0, 80) },
          { icon: '🚧', label: '卡關', value: String(payload.pain || '無').substring(0, 100) },
          { icon: '✨', label: '期望', value: String(payload.wish || '無').substring(0, 100) },
          { icon: '📢', label: '推薦', value: String(RECOMMEND_MAP[payload.recommend] || payload.recommend || '未填').substring(0, 30) },
          { icon: '💌', label: '其他', value: String(payload.extra || '無').substring(0, 100) },
          { icon: '📧', label: '聯絡', value: String(payload.email || '未留').substring(0, 50) },
        ],
        footerNote: '完整內容已存到 Firestore 的 coolclass_feedback',
      };

    case 'backup_exported':
      return {
        status: 'success',
        title: '使用者完成資料備份',
        appName: '教室小幫手',
        fields: [
          ...baseFields,
          { icon: '💾', label: '大小', value: String(payload.size || '—').substring(0, 30) },
          { icon: '📦', label: '工具', value: String(payload.tools || '—').substring(0, 50) },
        ],
        footerNote: '有人在認真用 ✨',
      };

    case 'first_install':
      return {
        status: 'started',
        title: '🎉 新使用者首次完成引導',
        appName: '教室小幫手',
        fields: [
          ...baseFields,
          { icon: '🌐', label: '頁面', value: url || '—' },
          { icon: '📱', label: '裝置', value: ua || '—' },
        ],
        footerNote: '推廣有效果！',
      };

    case 'js_error':
      return {
        status: 'failed',
        title: '⚠️ 前端發生 JS 錯誤',
        appName: '教室小幫手',
        fields: [
          { icon: '💬', label: '錯誤', value: String(payload.message || '—').substring(0, 200) },
          { icon: '📄', label: '檔案', value: String(payload.source || '—').substring(0, 100) },
          { icon: '🌐', label: '頁面', value: url || '—' },
          { icon: '📱', label: '裝置', value: ua || '—' },
        ],
        footerNote: '需要修復',
      };

    case 'tool_first_use':
      return {
        status: 'started',
        title: '使用者第一次用某工具',
        appName: '教室小幫手',
        fields: [
          ...baseFields,
          { icon: '🛠', label: '工具', value: String(payload.tool || '—') },
        ],
      };

    default:
      return {
        status: 'warning',
        title: '收到未知事件：' + String(event),
        appName: '教室小幫手',
        fields: [
          { icon: '📋', label: '原始 payload', value: JSON.stringify(payload).substring(0, 300) },
        ],
      };
  }
}

// ===== Build Flex Bubble =====
function buildFlexBubble(card) {
  const theme = CARD_THEMES[card.status] || CARD_THEMES.warning;
  const now = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());

  const headerContents = [
    { type: 'text', text: theme.icon, color: '#FFFFFF', size: 'xl' },
    { type: 'text', text: card.title, color: '#FFFFFF', weight: 'bold', size: 'lg', wrap: true, margin: 'sm' },
  ];
  if (card.appName) {
    headerContents.push({ type: 'text', text: card.appName, color: theme.headerSubColor, size: 'sm', margin: 'xs' });
  }

  const bodyContents = card.fields.map((f) => {
    const row = [];
    if (f.icon) row.push({ type: 'text', text: f.icon, size: 'sm', flex: 0, color: '#64748B' });
    row.push(
      { type: 'text', text: f.label, color: '#64748B', size: 'sm', flex: f.icon ? 3 : 4, weight: 'bold' },
      { type: 'text', text: f.value || '—', color: '#0F172A', size: 'sm', flex: 6, wrap: true },
    );
    return { type: 'box', layout: 'horizontal', spacing: 'sm', contents: row };
  });

  return {
    type: 'bubble', size: 'mega',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: theme.headerBg, paddingAll: '16px', spacing: 'none',
      contents: headerContents,
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
      contents: bodyContents,
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '12px',
      contents: [{
        type: 'text',
        text: card.footerNote ? `${now} · ${card.footerNote}` : now,
        color: '#94A3B8', size: 'xs', align: 'end', wrap: true,
      }],
    },
  };
}

function cardToText(card) {
  const theme = CARD_THEMES[card.status] || CARD_THEMES.warning;
  return [
    `${theme.icon} ${card.title}`,
    card.appName ? `(${card.appName})` : '',
    '',
    ...card.fields.map(f => `${f.icon || ''} ${f.label}：${f.value || '—'}`),
    card.footerNote ? `\n${card.footerNote}` : '',
  ].filter(Boolean).join('\n').substring(0, 4900);
}

// ===== Google Chat =====
// Chat 卡片不放個資與使用者輸入全文：自由文字只取前 30 字，並濾掉亂碼（U+FFFD）與控制字元
function chatSafe(value) {
  return Array.from(String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F-\u009F\uFFFD]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
    .slice(0, 30)
    .join('') || '—';
}

function chatFields(card) {
  return card.fields.map((f) => {
    // 聯絡信箱屬於個資，Chat 只標示有沒有留
    if (f.label === '聯絡') {
      const left = f.value && f.value !== '未留';
      return { icon: f.icon, label: f.label, value: left ? '有留（到 Firestore 的 coolclass_feedback 查看）' : '未留' };
    }
    return { icon: f.icon, label: f.label, value: chatSafe(f.value) };
  });
}

async function pushGoogleChat(webhookUrl, card) {
  const url = (webhookUrl || '').trim();
  if (!url || url === 'DISABLED') {
    logger.info('[notifyLine] GOOGLE_CHAT_WEBHOOK_URL not set, skip chat');
    return false;
  }
  const theme = CARD_THEMES[card.status] || CARD_THEMES.warning;
  const now = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  const fields = chatFields(card);
  const platformName = card.appName || APP_NAME;
  const widgets = fields.map((f) => ({
    decoratedText: {
      topLabel: f.label,
      text: (f.icon ? `${f.icon} ` : '') + f.value,
      wrapText: true,
    },
  }));
  widgets.push({
    decoratedText: {
      topLabel: card.footerNote ? '時間與備註' : '時間',
      text: `🕒 ${now}${card.footerNote ? ` · ${card.footerNote}` : ''}`,
      wrapText: true,
    },
  });
  const summary = fields.slice(0, 2).map((f) => `${f.label}: ${f.value}`).join(' | ');
  // 手機推播只看得到 text 這行，先放【平台名】，同一個 Chat 空間收多個系統時才分得出來
  const payload = {
    text: `${theme.icon} 【${platformName}】${card.title}${summary ? ` (${summary})` : ''}`,
    cardsV2: [{
      cardId: `coolclass-${Date.now()}`,
      card: {
        header: { title: `${theme.icon} ${card.title}｜${platformName}`, subtitle: platformName },
        sections: [{ widgets }],
      },
    }],
  };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      logger.warn('[notifyLine] google chat failed', { status: r.status, body: t.substring(0, 200) });
      return false;
    }
    return true;
  } catch (e) {
    logger.warn('[notifyLine] google chat exception', { msg: e.message });
    return false;
  }
}

// ===== LINE（只給錯誤卡片用）=====
async function pushLine(token, userId, card) {
  if (!token || token === 'DISABLED' || !userId || userId === 'DISABLED') {
    logger.info('[notifyLine] LINE secrets not set, skip line');
    return false;
  }
  const altText = `${(CARD_THEMES[card.status] || CARD_THEMES.warning).icon} ${card.title}`;
  const flex = buildFlexBubble(card);
  try {
    const lineRes = await fetch(LINE_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'flex', altText, contents: flex }],
      }),
    });
    if (lineRes.ok) return true;

    const errBody = await lineRes.text().catch(() => '');
    // 429 = 本月推播額度已用完，改純文字重送也一樣會被拒，直接略過
    if (lineRes.status === 429) {
      logger.warn('[notifyLine] LINE 本月推播額度已用完，略過', { body: errBody.substring(0, 120) });
      return false;
    }
    // Flex 失敗 fallback 純文字
    logger.warn('[notifyLine] flex failed, fallback to text', { status: lineRes.status, body: errBody.substring(0, 200) });
    const textRes = await fetch(LINE_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: cardToText(card) }],
      }),
    });
    if (!textRes.ok) {
      const t2 = await textRes.text().catch(() => '');
      logger.error('[notifyLine] both flex+text failed', { status: textRes.status, body: t2.substring(0, 200) });
      return false;
    }
    return true;
  } catch (e) {
    logger.warn('[notifyLine] line exception', { msg: e.message });
    return false;
  }
}

// ===== 簡易記憶體 rate limit =====
// 2026-11-23：研習時一次幾十位老師同時打開，原本「每分鐘 10 則」會把紀錄擋掉。
// 改成兩層：寫資料庫每個 instance 每分鐘 300 則（防惡意灌爆）、推 Google Chat 每分鐘 10 則（防洗版）。
// 超過 Chat 上限時照樣記到資料庫，只是不發通知。
function makeLimiter(max) {
  const log = [];
  return function allow() {
    const now = Date.now();
    while (log.length > 0 && log[0] < now - 60000) log.shift();
    if (log.length >= max) return false;
    log.push(now);
    return true;
  };
}
const allowRecord = makeLimiter(300);
const allowChat = makeLimiter(10);

// ===== Firestore 紀錄 =====
const KNOWN_EVENTS = new Set([
  'feedback_submitted', 'backup_exported', 'first_install', 'js_error', 'tool_open', 'tool_first_use',
]);
// 只記錄、不發 Chat 的事件（工具開啟一天會有上百次，發通知會洗版）
const SILENT_EVENTS = new Set(['tool_open', 'tool_first_use']);

const ROLE_MAP = { elementary: '國小老師', middle: '國中老師', high: '高中老師', cram: '補教/安親', admin: '行政/主任', other: '其他' };
const RECOMMEND_MAP = { yes: '已推薦', maybe: '可能會', not_yet: '試用中', no: '不太會' };

function clip(value, max) {
  if (value == null) return '';
  return Array.from(String(value)).slice(0, max).join('');
}

function cleanDevice(value) {
  const v = String(value || '');
  return /^[A-Za-z0-9-]{8,40}$/.test(v) ? v : '';
}

function cleanTool(value) {
  const v = String(value || '').toLowerCase();
  return /^[a-z0-9-]{1,30}$/.test(v) ? v : '';
}

function taipeiDay(date) {
  // en-CA 會輸出 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// 只挑每種事件需要的欄位存，不把前端送來的整包原封不動寫進資料庫
function pickDetail(event, payload) {
  switch (event) {
    case 'js_error':
      return { message: clip(payload.message, 300), source: clip(payload.source, 200) };
    case 'backup_exported':
      return { size: clip(payload.size, 30), tools: clip(payload.tools, 200) };
    case 'feedback_submitted':
      return { stars: Number(payload.stars) || 0, role: clip(payload.role, 30) };
    case 'unknown_event':
      return { raw: clip(JSON.stringify(payload), 300) };
    default:
      return {};
  }
}

async function recordEvent(event, payload) {
  const { db, FieldValue } = fsMod();
  const now = new Date();
  const day = taipeiDay(now);
  const device = cleanDevice(payload._device);
  const tool = cleanTool(payload.tool);
  const at = FieldValue.serverTimestamp();
  const base = {
    event,
    at,
    day,
    device: device || null,
    tool: tool || null,
    page: clip(payload._url, 100),
    classname: clip(payload._classname, 30),
    ua: clip(payload._ua, 160),
    clientTs: clip(payload._ts, 30),
    retried: payload._retry === true,
  };

  const writes = [];
  writes.push(db.collection('coolclass_events').add({ ...base, detail: pickDetail(event, payload) }));

  if (event === 'feedback_submitted') {
    writes.push(db.collection('coolclass_feedback').add({
      at,
      day,
      device: base.device,
      classname: base.classname,
      page: base.page,
      ua: base.ua,
      stars: Math.max(0, Math.min(5, Number(payload.stars) || 0)),
      role: ROLE_MAP[payload.role] || clip(payload.role, 30),
      recommend: RECOMMEND_MAP[payload.recommend] || clip(payload.recommend, 30),
      favs: clip(payload.favs, 500),
      pain: clip(payload.pain, 2000),
      wish: clip(payload.wish, 2000),
      extra: clip(payload.extra, 2000),
      email: clip(payload.email, 100),
    }));
  }

  // 每台裝置一份檔案：第一次出現時間、最後出現時間、用過哪些工具
  let isNewDevice = false;
  if (device) {
    const ref = db.collection('coolclass_devices').doc(device);
    writes.push(db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      isNewDevice = !snap.exists;
      const data = {
        lastSeen: at,
        lastDay: day,
        lastClass: base.classname,
        lastUa: base.ua,
        events: { [event]: FieldValue.increment(1) },
      };
      if (tool) data.tools = { [tool]: FieldValue.increment(1) };
      if (isNewDevice) {
        data.firstSeen = at;
        data.firstDay = day;
      }
      tx.set(ref, data, { merge: true });
    }));
  }
  await Promise.all(writes);

  // 每日統計（放在裝置檔之後，才知道是不是新裝置）
  const daily = { day, updatedAt: at, events: { [event]: FieldValue.increment(1) } };
  if (tool && event === 'tool_open') daily.tools = { [tool]: FieldValue.increment(1) };
  if (device) daily.devices = { [device]: true };
  if (isNewDevice) daily.newDevices = FieldValue.increment(1);
  await db.collection('coolclass_daily').doc(day).set(daily, { merge: true });
  return true;
}

// ===== Cloud Function =====
exports.notifyLine = onRequest({
  region: 'asia-east1',
  cors: true,
  maxInstances: 5,  // 控制成本
  secrets: [LINE_TOKEN, LINE_USER, GOOGLE_CHAT_WEBHOOK],
}, async (req, res) => {
  // CORS preflight 由 cors: true 處理
  if (req.method !== 'POST') {
    res.status(405).send({ ok: false, error: 'POST only' });
    return;
  }

  // Rate limit（資料庫層）
  if (!allowRecord()) {
    logger.warn('[notifyLine] rate limited');
    res.status(429).send({ ok: false, error: 'too many requests' });
    return;
  }

  const body = req.body || {};
  const rawEvent = String(body.event || 'unknown').substring(0, 40);
  const payload = (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) ? body.payload : {};
  if (JSON.stringify(payload).length > 20000) {
    res.status(413).send({ ok: false, error: 'payload too large' });
    return;
  }
  const event = KNOWN_EVENTS.has(rawEvent) ? rawEvent : 'unknown_event';

  // 舊版快取前端仍會送「Script error.」（跨網域腳本被瀏覽器隱藏內容的錯誤，無法修復），後端直接略過
  if (event === 'js_error') {
    const msg = String(payload.message || '').trim();
    const src = String(payload.source || '');
    if (/^script error\.?$/i.test(msg) || src === ':0:0') {
      logger.info('[notifyLine] ignore opaque cross-origin js_error', { msg, src });
      res.status(200).send({ ok: true, ignored: 'opaque-script-error' });
      return;
    }
  }

  // 附帶 server-side metadata
  payload._url = payload._url || (req.headers['referer'] || '').substring(0, 100);
  payload._ua = payload._ua || (req.headers['user-agent'] || '').substring(0, 100);

  // 1) 先記帳：寫進 Firestore
  let recorded = false;
  try {
    recorded = await recordEvent(event, payload);
  } catch (e) {
    // 寫不進資料庫時，把重點留在日誌裡，事後還查得到
    logger.error('[notifyLine] firestore write failed', {
      msg: e.message, event, device: cleanDevice(payload._device), tool: cleanTool(payload.tool),
      feedback: event === 'feedback_submitted' ? {
        stars: payload.stars, role: payload.role,
        pain: clip(payload.pain, 500), wish: clip(payload.wish, 500), extra: clip(payload.extra, 500),
      } : undefined,
    });
  }

  // 2) 再通知：工具開啟這類統計事件、未知事件、補送的舊事件不發 Chat（補送的回饋例外，還是要讓阿凱老師知道）
  const silent = SILENT_EVENTS.has(event) || event === 'unknown_event'
    || (payload._retry === true && event !== 'feedback_submitted');
  if (silent) {
    logger.info('[notifyLine] recorded', { event, recorded, tool: cleanTool(payload.tool) });
    // 資料庫失敗時回 503 讓前端稍後補送
    res.status(recorded ? 200 : 503).send({ ok: recorded, recorded });
    return;
  }

  if (!allowChat()) {
    logger.warn('[notifyLine] chat rate limited, recorded only', { event, recorded });
    res.status(200).send({ ok: recorded, recorded, chat: false, line: false, chatSkipped: 'rate-limit' });
    return;
  }

  const card = buildCardFromEvent(event, payload);
  // LINE 只推錯誤卡片（js_error），其餘事件只發 Google Chat
  const sendLine = card.status === 'failed';

  try {
    const [chat, line] = await Promise.all([
      pushGoogleChat(GOOGLE_CHAT_WEBHOOK.value(), card),
      sendLine ? pushLine(LINE_TOKEN.value().trim(), LINE_USER.value().trim(), card) : Promise.resolve(false),
    ]);
    logger.info('[notifyLine] sent', { event, recorded, chat, line, lineTried: sendLine });
    res.status(200).send({ ok: recorded || chat || line, recorded, chat, line });
  } catch (e) {
    logger.error('[notifyLine] exception', { msg: e.message });
    res.status(recorded ? 200 : 500).send({ ok: recorded, recorded, error: 'notify failed' });
  }
});

// ===== 健康檢查（給前端確認 endpoint 在）=====
exports.notifyLineHealth = onRequest({ region: 'asia-east1', cors: true }, (req, res) => {
  res.status(200).send({ ok: true, ts: Date.now() });
});
