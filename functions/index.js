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
 * 部署：
 *   cd functions && firebase deploy --only functions:notifyLine
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
          { icon: '👤', label: '身分', value: String(payload.role || '未填').substring(0, 30) },
          { icon: '💝', label: '常用', value: String(payload.favs || '無').substring(0, 80) },
          { icon: '🚧', label: '卡關', value: String(payload.pain || '無').substring(0, 100) },
          { icon: '✨', label: '期望', value: String(payload.wish || '無').substring(0, 100) },
          { icon: '📧', label: '聯絡', value: String(payload.email || '未留').substring(0, 50) },
        ],
        footerNote: '到 feedback.html 看完整訊息',
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
      return { icon: f.icon, label: f.label, value: left ? '有留（到 feedback.html 查看）' : '未留' };
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

// ===== 簡易記憶體 rate limit（每個 instance 60 秒內最多 10 條）=====
const rateLog = [];
function checkRateLimit() {
  const now = Date.now();
  // 清掉 60 秒前的紀錄
  while (rateLog.length > 0 && rateLog[0] < now - 60000) rateLog.shift();
  if (rateLog.length >= 10) return false;
  rateLog.push(now);
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

  // Rate limit
  if (!checkRateLimit()) {
    logger.warn('[notifyLine] rate limited');
    res.status(429).send({ ok: false, error: 'too many requests' });
    return;
  }

  const body = req.body || {};
  const event = body.event || 'unknown';
  const payload = body.payload || {};

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

  const card = buildCardFromEvent(event, payload);
  // LINE 只推錯誤卡片（js_error），其餘事件只發 Google Chat
  const sendLine = card.status === 'failed';

  try {
    const [chat, line] = await Promise.all([
      pushGoogleChat(GOOGLE_CHAT_WEBHOOK.value(), card),
      sendLine ? pushLine(LINE_TOKEN.value().trim(), LINE_USER.value().trim(), card) : Promise.resolve(false),
    ]);
    logger.info('[notifyLine] sent', { event, chat, line, lineTried: sendLine });
    res.status(200).send({ ok: chat || line, chat, line });
  } catch (e) {
    logger.error('[notifyLine] exception', { msg: e.message });
    res.status(500).send({ ok: false, error: 'notify failed' });
  }
});

// ===== 健康檢查（給前端確認 endpoint 在）=====
exports.notifyLineHealth = onRequest({ region: 'asia-east1', cors: true }, (req, res) => {
  res.status(200).send({ ok: true, ts: Date.now() });
});
