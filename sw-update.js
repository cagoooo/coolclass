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

  // ===== Banner UI =====
  function showBanner(newVersion) {
    if (updateAvailable) return;
    if (document.getElementById('akai-update-banner')) return;
    updateAvailable = true;

    // 注入樣式
    if (!document.getElementById('akai-update-style')) {
      const style = document.createElement('style');
      style.id = 'akai-update-style';
      style.textContent = `
        @keyframes akai-update-pop {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        #akai-update-banner {
          position: fixed; bottom: 20px; left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #ff8aaa 0%, #ffaa70 100%);
          color: #fff;
          padding: 12px 18px 12px 22px;
          border-radius: 999px;
          font-weight: 700;
          box-shadow: 0 10px 30px rgba(255,150,120,.4),
                      0 0 0 4px rgba(255,255,255,.6);
          display: flex; align-items: center; gap: 10px;
          z-index: 999999;
          font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif;
          animation: akai-update-pop .4s cubic-bezier(.34,1.56,.64,1);
          max-width: 92vw;
          flex-wrap: wrap;
          justify-content: center;
        }
        #akai-update-banner .akai-text {
          font-size: 14px; line-height: 1.4;
        }
        #akai-update-banner .akai-ver {
          font-size: 10px; opacity: .85;
          background: rgba(255,255,255,.25);
          padding: 2px 8px; border-radius: 999px;
          margin-left: 6px;
          letter-spacing: 1px;
          font-weight: 600;
        }
        #akai-update-banner button {
          border: none; cursor: pointer;
          font-family: inherit; font-weight: 700;
          transition: transform .15s;
        }
        #akai-update-banner button:hover { transform: scale(1.05); }
        #akai-update-banner .akai-go {
          background: #fff; color: #c8568a;
          padding: 7px 16px; border-radius: 999px;
          font-size: 14px;
          box-shadow: 0 2px 6px rgba(0,0,0,.1);
        }
        #akai-update-banner .akai-x {
          background: transparent;
          color: rgba(255,255,255,.85);
          padding: 4px 8px;
          font-size: 16px;
          border-radius: 50%;
        }
        #akai-update-banner .akai-x:hover {
          background: rgba(255,255,255,.2);
          transform: scale(1.1);
        }
        @media (max-width: 480px) {
          #akai-update-banner {
            bottom: 12px;
            padding: 10px 14px;
            font-size: 13px;
          }
          #akai-update-banner .akai-ver { display: none; }
        }
      `;
      document.head.appendChild(style);
    }

    const banner = document.createElement('div');
    banner.id = 'akai-update-banner';
    banner.innerHTML = `
      <span class="akai-text">
        🌈 有新版本了！更新一下嘗鮮看看 ✨
        ${newVersion ? `<span class="akai-ver">v${newVersion}</span>` : ''}
      </span>
      <button class="akai-go" id="akai-update-reload">立刻更新</button>
      <button class="akai-x" id="akai-update-dismiss" title="稍後再說">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('akai-update-reload').onclick = async () => {
      // 顯示 loading 狀態避免使用者誤以為沒反應
      const btn = document.getElementById('akai-update-reload');
      btn.textContent = '更新中…';
      btn.disabled = true;
      // 清掉所有 cache，確保完全吃新版
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
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
      // 5 分鐘後又會再來一次（如果版本還是新的）
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
        showBanner(data.version);
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

  // ===== v3.6：30 天備份提醒 =====
  // 若使用者有大量資料、且 30+ 天沒匯出備份，跳藍色 banner
  const BACKUP_KEY = 'akai_last_backup_v1';
  const BACKUP_DISMISS_KEY = 'akai_backup_reminder_dismissed_v1';
  const BACKUP_DAYS_THRESHOLD = 30;
  const DISMISS_DAYS = 14;  // 暫時關閉 14 天後再提醒

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

  function showBackupBanner(daysSince) {
    if (document.getElementById('akai-backup-banner')) return;
    if (document.getElementById('akai-update-banner')) return;  // 別跟更新 banner 撞

    if (!document.getElementById('akai-backup-style')) {
      const s = document.createElement('style');
      s.id = 'akai-backup-style';
      s.textContent = `
        #akai-backup-banner {
          position: fixed; bottom: 20px; left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #4d96ff 0%, #6bcb77 100%);
          color: #fff;
          padding: 12px 18px 12px 22px;
          border-radius: 999px;
          font-weight: 700;
          box-shadow: 0 10px 30px rgba(80,150,255,.4),
                      0 0 0 4px rgba(255,255,255,.6);
          display: flex; align-items: center; gap: 10px;
          z-index: 999998;
          font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif;
          animation: akai-update-pop .4s cubic-bezier(.34,1.56,.64,1);
          max-width: 92vw;
          flex-wrap: wrap;
          justify-content: center;
        }
        #akai-backup-banner .akai-bk-text { font-size: 14px; line-height: 1.4; }
        #akai-backup-banner .akai-bk-days {
          font-size: 11px; opacity: .9;
          background: rgba(255,255,255,.25);
          padding: 2px 8px; border-radius: 999px;
          margin-left: 6px;
          font-family: 'Fraunces', serif; font-style: italic;
          font-weight: 900;
        }
        #akai-backup-banner button {
          border: none; cursor: pointer;
          font-family: inherit; font-weight: 700;
          transition: transform .15s;
        }
        #akai-backup-banner button:hover { transform: scale(1.05); }
        #akai-backup-banner .akai-bk-go {
          background: #fff; color: #4d96ff;
          padding: 7px 14px; border-radius: 999px;
          font-size: 13px;
          box-shadow: 0 2px 6px rgba(0,0,0,.1);
        }
        #akai-backup-banner .akai-bk-x {
          background: transparent;
          color: rgba(255,255,255,.85);
          padding: 4px 8px;
          font-size: 16px;
          border-radius: 50%;
        }
        #akai-backup-banner .akai-bk-x:hover {
          background: rgba(255,255,255,.2);
        }
        @media (max-width: 480px) {
          #akai-backup-banner { bottom: 70px; padding: 10px 14px; font-size: 13px; }
        }
      `;
      document.head.appendChild(s);
    }

    const banner = document.createElement('div');
    banner.id = 'akai-backup-banner';
    banner.innerHTML = `
      <span class="akai-bk-text">
        💾 該備份了！上次備份已經<span class="akai-bk-days">${daysSince} 天前</span>
      </span>
      <button class="akai-bk-go" id="akai-bk-go">立即備份</button>
      <button class="akai-bk-x" id="akai-bk-x" title="14 天後再提醒">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('akai-bk-go').onclick = () => {
      banner.remove();
      // 直接跳到備份頁
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
        // 從未備份過 — 但給 30 天的觀察期
        const firstUse = localStorage.getItem('akai_first_use_v1');
        if (!firstUse) {
          localStorage.setItem('akai_first_use_v1', new Date().toISOString());
          return;
        }
        const since = Math.floor((Date.now() - new Date(firstUse).getTime()) / (86400 * 1000));
        if (since >= BACKUP_DAYS_THRESHOLD) showBackupBanner(since);
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
