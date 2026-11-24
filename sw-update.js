/* sw-update.js — Service Worker 註冊 + 更新偵測 + 通知 banner
 * 雙線偵測，避免漏抓更新：
 *   線 A：SW lifecycle 事件 (updatefound + statechange + postMessage)
 *   線 B：polling version.json（focus / visibilitychange / pageshow / online + 每 3 分鐘）
 *
 * 接受 GitHub Pages CDN cache 10 分鐘的事實 — 兩條線任一條看到更新就 banner。
 * 引用方式：<script src="sw-update.js" defer></script>
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  const VERSION_URL = './version.json';
  const POLL_INTERVAL_MS = 3 * 60 * 1000;   // 3 分鐘
  const FIRST_CHECK_DELAY_MS = 5 * 1000;     // 5 秒
  const SW_CHECK_INTERVAL_MS = 30 * 60 * 1000; // SW 主動 update 每 30 分鐘

  let clientVersion = null;      // client 啟動時看到的版本（基準）
  let updateAvailable = false;   // 已經顯示過 banner

  // ===== 通知卡片共用樣式（v4.7：更新通知、備份提醒共用）=====
  // 電腦：畫面下方置中的卡片（避開右下角工具導航按鈕）
  // 手機：從底部滑出的面板，按鈕又大又好點，會避開 iPhone 底部橫條
  function ensureSheetStyle() {
    if (document.getElementById('akai-sheet-style')) return;
    const style = document.createElement('style');
    style.id = 'akai-sheet-style';
    style.textContent = `
      @keyframes akai-sheet-in {
        from { transform: translate(-50%, 24px); opacity: 0; }
        to   { transform: translate(-50%, 0);    opacity: 1; }
      }
      .akai-sheet {
        position: fixed; left: 50%; bottom: 24px;
        transform: translate(-50%, 0);
        width: min(560px, calc(100vw - 200px));
        box-sizing: border-box;
        display: flex; align-items: center; gap: 14px;
        padding: 14px 16px 14px 14px;
        background: #fffdf6; color: #2a1f4a;
        border: 3px solid #2a1f4a; border-radius: 20px;
        box-shadow: 5px 5px 0 #2a1f4a, 0 18px 40px rgba(42,31,74,.18);
        font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif;
        z-index: 999999;
        animation: akai-sheet-in .35s cubic-bezier(.34,1.4,.64,1);
      }
      .akai-sheet .akai-sh-icon {
        flex: 0 0 48px; width: 48px; height: 48px; border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
        font-size: 26px; border: 2.5px solid #2a1f4a;
        background: linear-gradient(135deg, #ff97c5, #ffd23f);
      }
      .akai-sheet.akai-sh-blue .akai-sh-icon { background: linear-gradient(135deg, #4d96ff, #6bcb77); }
      .akai-sheet .akai-sh-body { flex: 1 1 auto; min-width: 0; }
      .akai-sheet .akai-sh-title { display: block; font-weight: 900; font-size: 16px; line-height: 1.35; }
      .akai-sheet .akai-sh-text {
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        font-size: 14px; line-height: 1.5; color: #44345e; margin-top: 2px;
      }
      .akai-sheet .akai-sh-meta { display: block; font-size: 12px; color: #8a7aa8; margin-top: 3px; }
      .akai-sheet .akai-sh-actions { flex: 0 0 auto; display: flex; gap: 8px; align-items: center; }
      .akai-sheet button {
        font-family: inherit; font-weight: 800; font-size: 14px; cursor: pointer;
        min-height: 42px; padding: 0 16px; border-radius: 999px;
        border: 2.5px solid #2a1f4a; transition: transform .12s, box-shadow .12s;
        white-space: nowrap;
      }
      .akai-sheet .akai-sh-go { background: #2a1f4a; color: #fffdf6; box-shadow: 2px 2px 0 #ff97c5; }
      .akai-sheet.akai-sh-blue .akai-sh-go { box-shadow: 2px 2px 0 #4d96ff; }
      .akai-sheet .akai-sh-later { background: #fff; color: #2a1f4a; }
      .akai-sheet button:hover:not(:disabled) { transform: translate(-1px, -1px); }
      .akai-sheet button:active:not(:disabled) { transform: translate(1px, 1px); box-shadow: none; }
      .akai-sheet button:disabled { opacity: .7; cursor: progress; }
      .akai-sheet button:focus-visible { outline: 3px solid #4d96ff; outline-offset: 2px; }

      @keyframes akai-sheet-up {
        from { transform: translateY(110%); }
        to   { transform: translateY(0); }
      }
      @media (max-width: 720px) {
        .akai-sheet {
          left: 10px; right: 10px; bottom: calc(10px + env(safe-area-inset-bottom, 0px));
          width: auto; transform: none;
          flex-wrap: wrap; gap: 12px;
          padding: 14px; border-radius: 18px;
          animation-name: akai-sheet-up;
        }
        .akai-sheet .akai-sh-icon { flex-basis: 44px; width: 44px; height: 44px; font-size: 24px; }
        .akai-sheet .akai-sh-text { -webkit-line-clamp: 3; }
        .akai-sheet .akai-sh-body { flex: 1 1 calc(100% - 60px); }
        .akai-sheet .akai-sh-actions { flex: 1 1 100%; }
        .akai-sheet .akai-sh-actions button { flex: 1 1 0; min-height: 46px; font-size: 15px; }
        .akai-sheet .akai-sh-go { flex-grow: 2 !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .akai-sheet { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // 「20261123-2138-e0ec1a6」→「11/23 21:38」
  function versionLabel(v) {
    const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(String(v || ''));
    return m ? `${Number(m[2])}/${Number(m[3])} ${m[4]}:${m[5]}` : '';
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 按「稍後」後，同一個版本 30 分鐘內不再跳（以前每 3 分鐘檢查一次就又跳出來）
  const SNOOZE_KEY = 'akai_update_snooze_v1';
  const SNOOZE_MS = 30 * 60 * 1000;
  function isSnoozed(version) {
    try {
      const s = JSON.parse(sessionStorage.getItem(SNOOZE_KEY) || 'null');
      return !!(s && s.v === (version || '') && Date.now() - s.t < SNOOZE_MS);
    } catch { return false; }
  }

  // ===== Banner UI =====
  async function showBanner(newVersion, notes) {
    if (updateAvailable) return;
    if (document.getElementById('akai-update-banner')) return;
    if (isSnoozed(newVersion)) return;
    updateAvailable = true;

    // 從 SW 事件來的通知沒有說明文字，順手讀一下 version.json
    if (!notes) {
      try {
        const r = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' });
        const d = r.ok ? await r.json() : null;
        if (d) { notes = d.notes; newVersion = newVersion || d.version; }
      } catch (e) {}
      if (isSnoozed(newVersion)) { updateAvailable = false; return; }
    }
    // 備份提醒正在顯示的話，先收起來（更新比較重要，兩張卡不要疊在一起）
    const bk = document.getElementById('akai-backup-banner');
    if (bk) bk.remove();

    ensureSheetStyle();
    const label = versionLabel(newVersion);
    const showNotes = notes && notes !== '自動升版';
    const banner = document.createElement('div');
    banner.id = 'akai-update-banner';
    banner.className = 'akai-sheet';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <span class="akai-sh-icon" aria-hidden="true">🌈</span>
      <span class="akai-sh-body">
        <strong class="akai-sh-title">教室小幫手有新版本囉！</strong>
        <span class="akai-sh-text">${showNotes ? '這次更新：' + escHtml(notes) : '重新整理一下，就能使用最新功能。'}</span>
        ${label ? `<span class="akai-sh-meta">版本 ${escHtml(label)}・資料不會受影響</span>` : '<span class="akai-sh-meta">資料不會受影響</span>'}
      </span>
      <span class="akai-sh-actions">
        <button type="button" class="akai-sh-later" id="akai-update-dismiss">稍後</button>
        <button type="button" class="akai-sh-go" id="akai-update-reload">立即更新</button>
      </span>
    `;
    document.body.appendChild(banner);

    document.getElementById('akai-update-reload').onclick = async () => {
      // 顯示 loading 狀態避免使用者誤以為沒反應
      const btn = document.getElementById('akai-update-reload');
      btn.textContent = '更新中…';
      btn.disabled = true;
      // 清掉本站自己的 cache，確保完全吃新版（同網域其他工具的快取不動）
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(k => k.startsWith('akai-classroom-')).map(k => caches.delete(k)));
        }
      } catch (e) {}
      // 通知 SW skipWaiting（如果有 waiting 中的）
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch (e) {}
      // 短暫延遲讓 SW 切換完成
      setTimeout(() => location.reload(), 200);
    };
    document.getElementById('akai-update-dismiss').onclick = () => {
      banner.remove();
      updateAvailable = false;
      try { sessionStorage.setItem(SNOOZE_KEY, JSON.stringify({ v: newVersion || '', t: Date.now() })); } catch (e) {}
    };
  }

  // ===== 線 A：SW lifecycle =====
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        // 每 30 分鐘主動觸發一次 update check（讓瀏覽器去比對 sw.js byte）
        setInterval(() => { reg.update().catch(() => {}); }, SW_CHECK_INTERVAL_MS);

        // updatefound：新 SW 正在 install
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            // 新 SW 安裝完成、且舊 SW 還在掌控當前頁 → 真的有更新
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showBanner();
            }
          });
        });
      })
      .catch(err => {
        // 註冊失敗不要 throw，靜默就好
        console.warn('[SW] register failed:', err);
      });
  });

  // 收 SW 的 postMessage（從 activate 階段廣播）
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SW_ACTIVATED') {
      // 第一次啟動不算更新（沒有舊 controller 才視為首次）
      if (navigator.serviceWorker.controller) {
        showBanner(e.data.version);
      }
    }
  });

  // controllerchange：當 waiting SW 接管時，重整一次讓所有資源跑新版
  let isReloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) return;
    // 如果使用者剛按過「立刻更新」，那邊已經 reload 過，這裡 skip
    // 沒按過的話也不要自動 reload，避免打斷使用者
  });

  // ===== 線 B：polling version.json =====
  async function checkVersion() {
    try {
      const r = await fetch(VERSION_URL + '?t=' + Date.now(), {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!r.ok) return;
      const data = await r.json();
      if (!data || !data.version) return;
      if (!clientVersion) {
        clientVersion = data.version;
        return;
      }
      if (data.version !== clientVersion) {
        showBanner(data.version, data.notes);
      }
    } catch (e) {
      // 離線或網路錯誤就 silent
    }
  }

  // 各種 trigger 都檢查一次
  setTimeout(checkVersion, FIRST_CHECK_DELAY_MS);
  setInterval(checkVersion, POLL_INTERVAL_MS);
  window.addEventListener('focus', checkVersion);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) checkVersion(); });
  window.addEventListener('online', checkVersion);

  // ===== v3.6：備份提醒（v4.6 由 30 天縮短為 14 天）=====
  // 若使用者有資料、且 14+ 天沒匯出備份，跳藍色 banner
  const BACKUP_KEY = 'akai_last_backup_v1';
  const BACKUP_DISMISS_KEY = 'akai_backup_reminder_dismissed_v1';
  const BACKUP_DAYS_THRESHOLD = 14;
  const DISMISS_DAYS = 7;  // 暫時關閉 7 天後再提醒

  // ===== v4.6：請瀏覽器保留這個網站的資料 =====
  // 沒有「保留」時，瀏覽器在空間不足（或 Safari 很久沒打開）時可能自動清掉 localStorage。
  // Chrome／Edge／Safari 會自己判斷、不跳視窗；Firefox 會跳詢問視窗，所以 Firefox 不自動問（備份頁有按鈕）。
  setTimeout(function () {
    try {
      if (!navigator.storage || !navigator.storage.persist || !navigator.storage.persisted) return;
      if (/Firefox\//.test(navigator.userAgent)) return;
      if (!hasMeaningfulData()) return;
      navigator.storage.persisted().then(function (ok) {
        if (ok) return;
        const asked = localStorage.getItem('akai_persist_asked_v1');
        if (asked && Date.now() - new Date(asked).getTime() < 7 * 86400000) return;  // 一週最多問一次
        localStorage.setItem('akai_persist_asked_v1', new Date().toISOString());
        return navigator.storage.persist();
      }).catch(function () {});
    } catch (e) {}
  }, 10000);

  function hasMeaningfulData() {
    // 檢查至少有 roster 或多月出勤紀錄才提醒
    try {
      const roster = JSON.parse(localStorage.getItem('akai_roster_v1') || '{}');
      if (roster.className && roster.count) return true;
      // 或：累計有 ≥ 50KB akai_* 資料
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('akai_')) total += (localStorage.getItem(k) || '').length;
      }
      return total >= 50 * 1024;  // ≥ 50KB
    } catch { return false; }
  }

  function showBackupBanner(daysSince, neverBackedUp) {
    if (document.getElementById('akai-backup-banner')) return;
    if (document.getElementById('akai-update-banner')) return;  // 別跟更新通知疊在一起
    if (/backup\.html$/.test(location.pathname)) return;         // 已經在備份頁就不用提醒

    ensureSheetStyle();
    const banner = document.createElement('div');
    banner.id = 'akai-backup-banner';
    banner.className = 'akai-sheet akai-sh-blue';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <span class="akai-sh-icon" aria-hidden="true">💾</span>
      <span class="akai-sh-body">
        <strong class="akai-sh-title">${neverBackedUp ? `已經使用 ${daysSince} 天，還沒備份過` : `上次備份是 ${daysSince} 天前`}</strong>
        <span class="akai-sh-text">班級資料只存在這台電腦，換電腦或清除瀏覽器就會不見。</span>
      </span>
      <span class="akai-sh-actions">
        <button type="button" class="akai-sh-later" id="akai-bk-x">${DISMISS_DAYS} 天後提醒</button>
        <button type="button" class="akai-sh-go" id="akai-bk-go">立即備份</button>
      </span>
    `;
    document.body.appendChild(banner);

    document.getElementById('akai-bk-go').onclick = () => {
      banner.remove();
      location.href = './backup.html';
    };
    document.getElementById('akai-bk-x').onclick = () => {
      banner.remove();
      try { localStorage.setItem(BACKUP_DISMISS_KEY, new Date().toISOString()); } catch {}
    };
  }

  function checkBackupReminder() {
    try {
      // 暫時關閉中？
      const dismissed = localStorage.getItem(BACKUP_DISMISS_KEY);
      if (dismissed) {
        const days = (Date.now() - new Date(dismissed).getTime()) / (86400 * 1000);
        if (days < DISMISS_DAYS) return;
      }
      // 沒有有意義的資料就不提醒
      if (!hasMeaningfulData()) return;
      // 計算距上次備份天數
      const last = localStorage.getItem(BACKUP_KEY);
      if (!last) {
        // 從未備份過 — 先給 14 天的觀察期
        const firstUse = localStorage.getItem('akai_first_use_v1');
        if (!firstUse) {
          localStorage.setItem('akai_first_use_v1', new Date().toISOString());
          return;
        }
        const since = Math.floor((Date.now() - new Date(firstUse).getTime()) / (86400 * 1000));
        if (since >= BACKUP_DAYS_THRESHOLD) showBackupBanner(since, true);
        return;
      }
      const since = Math.floor((Date.now() - new Date(last).getTime()) / (86400 * 1000));
      if (since >= BACKUP_DAYS_THRESHOLD) showBackupBanner(since);
    } catch (e) {}
  }

  // 延遲 8 秒檢查（讓更新 banner 優先）
  setTimeout(checkBackupReminder, 8000);

  // 提供全域 API 給 backup.html 呼叫（成功備份後重置計數）
  window.AkaiMarkBackup = function () {
    try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch {}
  };
})();
