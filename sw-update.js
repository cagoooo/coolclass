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
})();
