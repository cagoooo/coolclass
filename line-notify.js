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
 *
 * v4.4（2026-11-23）：
 * - 匿名裝置代號 _device（隨機產生，存在 akai_device_id_v1，不含任何個資），後端用來分辨新老師與同一人換頁
 * - tool_open：每個工具頁每天只記一次「今天有打開」，後端只存資料庫、不發通知
 * - 送失敗（斷線、伺服器忙）先存在 akai_notify_queue_v1，下次開頁或恢復連線時補送
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

  function shouldSend(key) {
    const now = Date.now();
    const last = dedupeMap.get(key) || 0;
    if (now - last < DEDUPE_WINDOW_MS) return false;
    dedupeMap.set(key, now);
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

  // ====== 使用漏斗用的小旗標（v4.8）：在哪種瀏覽器、完成引導了沒、設定班級名單了沒 ======
  function inAppKind() {
    if (window.AkaiInApp) return window.AkaiInApp;
    const ua = navigator.userAgent || '';
    if (/\bLine\//i.test(ua)) return 'line';
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/; wv\)/.test(ua)) return 'webview';
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'app';
    return '';
  }
  function flag(key) {
    try { return localStorage.getItem(key) === '1' ? 1 : 0; } catch { return 0; }
  }
  function hasRoster() {
    try {
      const r = JSON.parse(localStorage.getItem('akai_roster_v1') || 'null');
      return !!(r && (String(r.className || '').trim() || Object.keys(r.names || {}).some(k => String(r.names[k] || '').trim())));
    } catch { return false; }
  }

  // ====== 匿名裝置代號（v4.4）======
  // 只是一串隨機字，用來分辨「新老師」和「同一人換頁」，不含姓名、信箱等任何個資。
  const DEVICE_KEY = 'akai_device_id_v1';
  let memoryDeviceId = '';
  function getDeviceId() {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (id && /^[A-Za-z0-9-]{8,40}$/.test(id)) return id;
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch {
      if (!memoryDeviceId) memoryDeviceId = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      return memoryDeviceId;
    }
  }

  // ====== 送失敗補送佇列（v4.4）======
  const QUEUE_KEY = 'akai_notify_queue_v1';
  const QUEUE_MAX = 30;
  const QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function readQueue() {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(q) ? q : [];
    } catch { return []; }
  }
  function writeQueue(q) {
    try {
      if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
      else localStorage.removeItem(QUEUE_KEY);
    } catch {}
  }
  function enqueue(event, payload) {
    const q = readQueue();
    q.push({ event, payload, queuedAt: Date.now() });
    writeQueue(q);
  }

  function post(event, payload) {
    // 用 keepalive: true 讓頁面關閉時仍可送出
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
      mode: 'cors',
    }).then((r) => {
      // 429（伺服器忙）、5xx（暫時壞掉）值得稍後再送；4xx 其他狀況重送也沒用
      const retryable = r.status === 429 || r.status >= 500;
      return r.json().catch(() => ({ ok: r.ok })).then((j) => Object.assign({ ok: r.ok }, j, { retryable }));
    }).catch(() => ({ ok: false, retryable: true }));
  }

  let flushing = false;
  function flushQueue() {
    if (flushing || isDisabled()) return;
    if (navigator.onLine === false) return;
    const q = readQueue().filter(item => item && item.event && Date.now() - (item.queuedAt || 0) < QUEUE_MAX_AGE_MS);
    if (!q.length) { writeQueue([]); return; }
    flushing = true;
    writeQueue([]);
    const left = [];
    // 一筆一筆送，避免一次灌爆後端
    q.reduce((p, item) => p.then(() => {
      const payload = Object.assign({}, item.payload, { _retry: true });
      return post(item.event, payload).then((res) => {
        if (!res.ok && res.retryable) left.push(item);
      });
    }), Promise.resolve()).then(() => {
      if (left.length) writeQueue(left.concat(readQueue()));
      flushing = false;
    }, () => { flushing = false; });
  }

  /**
   * 送出事件
   * @param {string} event - 事件名（feedback_submitted / backup_exported / first_install / js_error / tool_open）
   * @param {object} payload - 事件資料
   * @param {boolean} [opts.skipDedupe] - 跳過去重檢查
   */
  function notify(event, payload, opts) {
    if (isDisabled()) return Promise.resolve({ skipped: 'disabled' });
    if (!event) return Promise.reject(new Error('event required'));
    if (!opts || !opts.skipDedupe) {
      const key = event + '|' + ((payload && payload.tool) || '');
      if (!shouldSend(key)) return Promise.resolve({ skipped: 'dedupe' });
    }
    payload = Object.assign({
      _classname: getClassName(),
      _url: location.pathname,
      _ua: navigator.userAgent.substring(0, 300),  // v4.8：保留完整，才分得出 LINE／臉書內建瀏覽器
      _ts: new Date().toISOString(),
      _device: getDeviceId(),
      _inapp: inAppKind(),
      _onb: flag('akai_onboarded_v1'),
      _roster: hasRoster() ? 1 : 0,
    }, payload || {});

    return post(event, payload).then((res) => {
      if (!res.ok && res.retryable) enqueue(event, payload);
      return res;
    });
  }

  // ====== 工具使用統計（v4.4）：每個工具頁每天只記一次 ======
  const TOOL_OPEN_KEY = 'akai_tool_open_v1';
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function currentTool() {
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const name = file.replace(/\.html?$/, '') || 'index';
    return /^[a-z0-9-]{1,30}$/.test(name) ? name : '';
  }
  function setupToolOpen() {
    const tool = currentTool();
    if (!tool) return;
    try {
      const today = todayStr();
      let rec = {};
      try { rec = JSON.parse(localStorage.getItem(TOOL_OPEN_KEY) || '{}') || {}; } catch { rec = {}; }
      if (rec.day !== today || !Array.isArray(rec.tools)) rec = { day: today, tools: [] };
      if (rec.tools.indexOf(tool) !== -1) return;
      rec.tools.push(tool);
      localStorage.setItem(TOOL_OPEN_KEY, JSON.stringify(rec));
      notify('tool_open', { tool }, { skipDedupe: true });
    } catch {}
  }

  // ====== 全域錯誤監聽 ======
  let errorReportedKey = null;

  // 只回報「自己網站的程式」出的錯。
  // - "Script error." + 沒有檔名：瀏覽器把跨網域腳本的錯誤內容藏起來（多半是 LINE／FB 內建瀏覽器、
  //   翻譯或外掛自己注入的程式），我們看不到也修不了，回報只是噪音。
  // - 檔名不是本站（chrome-extension://、其他網域）：同理略過。
  // - 資源載入失敗（img/script 404）的 error 事件沒有 message，也略過。
  function isOwnError(e) {
    const msg = String(e.message || '');
    const file = String(e.filename || '');
    if (!msg) return false;
    if (/^script error\.?$/i.test(msg.trim())) return false;
    if (!file) return false;
    try {
      if (new URL(file, location.href).origin !== location.origin) return false;
    } catch { return false; }
    return true;
  }

  function setupErrorHandler() {
    window.addEventListener('error', (e) => {
      try {
        if (!isOwnError(e)) return;
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
  setupToolOpen();
  // 頁面載入後 5 秒、以及恢復連線時，補送之前沒送成功的事件
  setTimeout(flushQueue, 5000);
  window.addEventListener('online', flushQueue);
})();
