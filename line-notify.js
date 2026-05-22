/* 教室小幫手｜LINE 通知前端 client（v4.2）
 *
 * 提供 window.AkaiNotifyLine(event, payload) 全域 API。
 * 把事件 POST 到 Cloud Function endpoint，由後端推到阿凱老師 LINE。
 *
 * 設計原則：
 * - 預設 endpoint 為阿凱老師的 Firebase 專案
 * - 失敗永遠靜默（不影響使用者操作）
 * - 自帶元資料：班級名、URL、UA
 * - 重複事件去重：同一個 event 1 分鐘內最多送 1 次
 * - 可關閉：使用者在 console 跑 `localStorage.setItem('akai_line_off','1')`
 */
(function () {
  'use strict';
  if (window.AkaiNotifyLine) return;

  // ====== Endpoint 設定（v4.3 已正式部署）======
  // Cloud Function: teachers-ai-assistant-g4iph / asia-east1
  // 部署於 2026-05-22 · secrets: COOLCLASS_LINE_CHANNEL_ACCESS_TOKEN + _ADMIN_USER_ID
  const ENDPOINT = 'https://asia-east1-teachers-ai-assistant-g4iph.cloudfunctions.net/notifyLine';

  // 給 fork 的老師：把上面 ENDPOINT 改成空字串即可停用整套通知。
  // 或在 console 跑 localStorage.setItem('akai_line_off','1')；

  // ====== 防重複觸發 ======
  const DEDUPE_WINDOW_MS = 60 * 1000;  // 同事件 60 秒內只送一次
  const dedupeMap = new Map();

  function shouldSend(event) {
    const now = Date.now();
    const last = dedupeMap.get(event) || 0;
    if (now - last < DEDUPE_WINDOW_MS) return false;
    dedupeMap.set(event, now);
    // 清理過舊紀錄
    for (const [k, v] of dedupeMap) {
      if (now - v > DEDUPE_WINDOW_MS * 5) dedupeMap.delete(k);
    }
    return true;
  }

  function isDisabled() {
    if (!ENDPOINT) return true;
    try {
      if (localStorage.getItem('akai_line_off') === '1') return true;
    } catch {}
    return false;
  }

  function getClassName() {
    try {
      if (window.AkaiRoster && typeof AkaiRoster.load === 'function') {
        const r = AkaiRoster.load();
        return (r && r.className) || '';
      }
      const raw = localStorage.getItem('akai_roster_v1');
      if (!raw) return '';
      const o = JSON.parse(raw);
      return (o && o.className) || '';
    } catch { return ''; }
  }

  /**
   * 通知 LINE
   * @param {string} event - 事件名（feedback_submitted / backup_exported / first_install / js_error / tool_first_use）
   * @param {object} payload - 事件資料
   * @param {boolean} [opts.skipDedupe] - 跳過去重檢查
   */
  function notify(event, payload, opts) {
    if (isDisabled()) return Promise.resolve({ skipped: 'disabled' });
    if (!event) return Promise.reject(new Error('event required'));
    if (!opts || !opts.skipDedupe) {
      if (!shouldSend(event)) return Promise.resolve({ skipped: 'dedupe' });
    }
    payload = Object.assign({
      _classname: getClassName(),
      _url: location.pathname,
      _ua: navigator.userAgent.substring(0, 80),
      _ts: new Date().toISOString(),
    }, payload || {});

    // 用 keepalive: true 讓頁面關閉時仍可送出
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
      mode: 'cors',
    }).then(r => r.json().catch(() => ({ ok: r.ok }))).catch(() => ({ ok: false }));
  }

  // ====== 全域錯誤監聽 ======
  let errorReportedKey = null;
  function setupErrorHandler() {
    window.addEventListener('error', (e) => {
      try {
        const msg = (e.message || '').substring(0, 200);
        const src = ((e.filename || '') + ':' + (e.lineno || 0) + ':' + (e.colno || 0)).substring(0, 200);
        const key = msg + src;
        // 同一個錯誤每 session 只送一次
        if (errorReportedKey === key) return;
        errorReportedKey = key;
        notify('js_error', { message: msg, source: src }, { skipDedupe: false });
      } catch {}
    });
    window.addEventListener('unhandledrejection', (e) => {
      try {
        const msg = ('Promise rejection: ' + (e.reason && (e.reason.message || e.reason))).substring(0, 200);
        const key = msg;
        if (errorReportedKey === key) return;
        errorReportedKey = key;
        notify('js_error', { message: msg, source: 'unhandledrejection' });
      } catch {}
    });
  }

  // ====== First install 偵測：onboarded_v1 = '1' 出現時推一次 ======
  function setupFirstInstall() {
    const KEY = 'akai_first_install_notified_v1';
    try {
      if (localStorage.getItem(KEY) === '1') return;  // 已通知過
      // 監聽 onboarded 從 '' → '1'
      const checkInterval = setInterval(() => {
        try {
          const onb = localStorage.getItem('akai_onboarded_v1');
          if (onb === '1') {
            clearInterval(checkInterval);
            if (localStorage.getItem(KEY) !== '1') {
              notify('first_install', {});
              localStorage.setItem(KEY, '1');
            }
          }
        } catch {}
      }, 3000);
      setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);  // 5 分鐘後放棄
    } catch {}
  }

  // ====== 對外 API ======
  window.AkaiNotifyLine = notify;
  window.AkaiNotifyLineConfig = {
    endpoint: ENDPOINT,
    enabled: !isDisabled(),
    disable() { try { localStorage.setItem('akai_line_off', '1'); } catch {} },
    enable() { try { localStorage.removeItem('akai_line_off'); } catch {} },
  };

  setupErrorHandler();
  setupFirstInstall();
})();
