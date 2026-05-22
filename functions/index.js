/**
 * 教室小幫手｜LINE 通知 Cloud Function
 *
 * 接收前端 POST /notifyLine，把事件用 Flex Card 推到阿凱老師 LINE。
 *
 * Secrets (用 firebase functions:secrets:set 設定)：
 *   COOLCLASS_LINE_CHANNEL_ACCESS_TOKEN  ← LINE long-lived token
 *   COOLCLASS_LINE_ADMIN_USER_ID         ← 阿凱老師個人 LINE userId
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
  secrets: [LINE_TOKEN, LINE_USER],
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

  const token = LINE_TOKEN.value().trim();
  const userId = LINE_USER.value().trim();

  // Fail-open：未設 secrets 時不擋 deploy
  if (!token || token === 'DISABLED' || !userId || userId === 'DISABLED') {
    logger.info('[notifyLine] secrets not set, no-op');
    res.status(200).send({ ok: true, noop: true, reason: 'secrets not configured' });
    return;
  }

  const body = req.body || {};
  const event = body.event || 'unknown';
  const payload = body.payload || {};

  // 附帶 server-side metadata
  payload._url = payload._url || (req.headers['referer'] || '').substring(0, 100);
  payload._ua = payload._ua || (req.headers['user-agent'] || '').substring(0, 100);

  const card = buildCardFromEvent(event, payload);
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

    if (!lineRes.ok) {
      // Flex 失敗 fallback 純文字
      const errBody = await lineRes.text();
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
        const t2 = await textRes.text();
        logger.error('[notifyLine] both flex+text failed', { status: textRes.status, body: t2.substring(0, 200) });
        res.status(500).send({ ok: false, error: 'line push failed' });
        return;
      }
    }

    logger.info('[notifyLine] sent', { event });
    res.status(200).send({ ok: true });
  } catch (e) {
    logger.error('[notifyLine] exception', { msg: e.message });
    res.status(500).send({ ok: false, error: e.message });
  }
});

// ===== 健康檢查（給前端確認 endpoint 在）=====
exports.notifyLineHealth = onRequest({ region: 'asia-east1', cors: true }, (req, res) => {
  res.status(200).send({ ok: true, ts: Date.now() });
});
