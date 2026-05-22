/* 教室小幫手｜統一儲存層（v3.9 B1）
 *
 * 解決 localStorage 5MB 死線：提供混合存取 API，
 * 大資料（情緒/出勤/行為觀察/親師溝通）自動走 IndexedDB，
 * 小資料（roster/tweaks/marquee 設定）繼續用 localStorage（讀取最快）。
 *
 * 對外暴露：
 *   await AkaiStore.get(key)        → 讀任一 key（自動判斷來源）
 *   await AkaiStore.set(key, value) → 寫任一 key（自動判斷目的地）
 *   await AkaiStore.remove(key)
 *   await AkaiStore.list()          → 列所有 key
 *   AkaiStore.getSync(key)          → 純 localStorage 同步讀（向下相容）
 *   AkaiStore.setSync(key, value)   → 純 localStorage 同步寫（向下相容）
 *   await AkaiStore.migrateAll()    → 把所有 BIG_KEYS 從 localStorage 搬到 IndexedDB
 *   await AkaiStore.getUsage()      → { used, quota, percent, breakdown }
 *   AkaiStore.onWarning(cb)         → quota > 70% 時 cb({percent, used, quota})
 *
 * 設計原則：
 * - 不強制改寫既有工具的程式碼（向下相容）
 * - 遷移後在 localStorage 留 marker，避免重複搬
 * - 寫入 localStorage 遇 QuotaExceededError 時 fallback 到 IndexedDB
 * - 提供 quota guard banner（在 80% 與 95% 觸發提示）
 */
(function () {
  'use strict';
  if (window.AkaiStore) return;

  const DB_NAME = 'akai_classroom';
  const DB_VERSION = 1;
  const STORE = 'kv';

  // 大資料 keys（一年下來會累積很多筆）
  const BIG_KEYS = new Set([
    'akai_emotion_v1',     // 每天每位學生一筆，一年 ~6000+ 筆
    'akai_attendance_v1',  // 每月一張表，一年 12 張，含每天標記
    'akai_behavior_v1',    // 隨時記錄，一年數百筆
    'akai_contact_v1',     // 親師溝通隨時記錄
    'akai_gallery_v1',     // 學生作品（圖片）— 早就在用 IndexedDB
    'akai_lesson_v1',      // 教案備忘可能很長
    'akai_lottery_v1',     // 抽籤集合可能很多
    'akai_finance_v1',     // 班費記帳一年很多筆
    'akai_substitute_v1',  // 代課交接單
    'akai_fieldtrip_v1',   // 戶外教學
  ]);

  // 已遷移標記
  const MIGRATED_MARKER = 'akai_idb_migrated_v1';

  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbSet(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function idbRemove(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function idbList() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function isMigrated() {
    try { return localStorage.getItem(MIGRATED_MARKER) === '1'; } catch { return false; }
  }
  function markMigrated() {
    try { localStorage.setItem(MIGRATED_MARKER, '1'); } catch {}
  }

  // ===== 公開 API =====
  const AkaiStore = {
    /**
     * 讀資料（async）。如果 key 是 BIG_KEY 且已遷移到 IndexedDB，從 IDB 讀；
     * 否則從 localStorage 讀（向下相容）
     */
    async get(key) {
      if (BIG_KEYS.has(key) && isMigrated()) {
        try { return await idbGet(key); } catch (e) {}
      }
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? null : (function () {
          try { return JSON.parse(raw); } catch { return raw; }
        })();
      } catch { return null; }
    },

    /**
     * 寫資料（async）。BIG_KEY 寫 IndexedDB（已遷移後）；其他寫 localStorage。
     * localStorage 失敗 (QuotaExceededError) 會自動 fallback 到 IndexedDB。
     */
    async set(key, value) {
      const isBig = BIG_KEYS.has(key);
      if (isBig && isMigrated()) {
        return await idbSet(key, value);
      }
      try {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, str);
      } catch (err) {
        if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
          console.warn('[AkaiStore] localStorage 滿了，改寫 IndexedDB:', key);
          await idbSet(key, value);
          if (!isMigrated()) markMigrated();
        } else throw err;
      }
    },

    async remove(key) {
      try { localStorage.removeItem(key); } catch {}
      try { await idbRemove(key); } catch {}
    },

    /**
     * 列所有 key（localStorage + IndexedDB 合併去重）
     */
    async list() {
      const ls = [];
      try {
        for (let i = 0; i < localStorage.length; i++) ls.push(localStorage.key(i));
      } catch {}
      let idb = [];
      try { idb = await idbList(); } catch {}
      return [...new Set([...ls, ...idb])].filter(k => k && k.startsWith('akai_'));
    },

    /**
     * 同步版（向下相容）
     */
    getSync(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? null : (function () {
          try { return JSON.parse(raw); } catch { return raw; }
        })();
      } catch { return null; }
    },
    setSync(key, value) {
      try {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, str);
      } catch (err) {
        if (err && err.name === 'QuotaExceededError') {
          // 同步寫法失敗時 async 補存進 IndexedDB（不阻塞）
          idbSet(key, value).catch(() => {});
          if (!isMigrated()) markMigrated();
        } else throw err;
      }
    },

    /**
     * 一鍵遷移：把所有 BIG_KEYS 從 localStorage 搬到 IndexedDB，
     * 釋放 localStorage 空間（保留小資料如 roster / tweaks）
     */
    async migrateAll() {
      const report = { moved: [], skipped: [], failed: [] };
      for (const key of BIG_KEYS) {
        try {
          const raw = localStorage.getItem(key);
          if (raw === null) { report.skipped.push(key); continue; }
          let val;
          try { val = JSON.parse(raw); } catch { val = raw; }
          await idbSet(key, val);
          localStorage.removeItem(key);
          report.moved.push(key);
        } catch (e) {
          console.error('[AkaiStore] 遷移失敗', key, e);
          report.failed.push({ key, err: String(e) });
        }
      }
      markMigrated();
      return report;
    },

    /**
     * 偵測儲存空間用量
     */
    async getUsage() {
      let used = 0, quota = 0;
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          used = est.usage || 0;
          quota = est.quota || 0;
        } catch {}
      }
      // 額外計 localStorage 用量
      let lsUsed = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          const v = localStorage.getItem(k) || '';
          lsUsed += k.length + v.length;
        }
      } catch {}
      return {
        used, quota,
        percent: quota > 0 ? (used / quota * 100) : 0,
        localStorageBytes: lsUsed * 2, // UTF-16 chars
        localStoragePercent: lsUsed * 2 / (5 * 1024 * 1024) * 100, // 假設 5MB 上限
        migrated: isMigrated(),
      };
    },

    isMigrated,

    BIG_KEYS: Array.from(BIG_KEYS),

    /**
     * Quota 警告 callback：在頁面 load 時被呼叫，若 localStorage 達 80%+ 觸發
     */
    onWarning: (function () {
      const callbacks = [];
      // 頁面 idle 時檢查一次
      setTimeout(async () => {
        try {
          const u = await AkaiStore.getUsage();
          if (u.localStoragePercent >= 80 && !u.migrated) {
            callbacks.forEach(cb => { try { cb(u); } catch {} });
          }
        } catch {}
      }, 3000);
      return function (cb) { callbacks.push(cb); };
    })(),
  };

  window.AkaiStore = AkaiStore;

  // ===== Quota guard banner =====
  AkaiStore.onWarning((u) => {
    if (document.getElementById('akai-quota-banner')) return;
    if (document.getElementById('akai-update-banner')) return;
    if (document.getElementById('akai-backup-banner')) return;

    const style = document.createElement('style');
    style.textContent = `
      #akai-quota-banner {
        position: fixed; bottom: 20px; left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff6b6b 0%, #ff9d4d 100%);
        color: #fff;
        padding: 14px 18px;
        border-radius: 14px;
        border: 3px solid #fff;
        box-shadow: 0 8px 24px rgba(0,0,0,.25);
        font-family: 'Noto Sans TC', system-ui, sans-serif;
        font-weight: 700;
        z-index: 9998;
        max-width: 92vw;
        display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      }
      #akai-quota-banner .qg-text { font-size: 14px; line-height: 1.4; }
      #akai-quota-banner .qg-pct {
        background: rgba(255,255,255,.25);
        padding: 2px 10px; border-radius: 999px;
        font-size: 12px; margin-left: 6px;
      }
      #akai-quota-banner button {
        border: none; cursor: pointer;
        font-family: inherit; font-weight: 700;
        padding: 7px 14px; border-radius: 999px;
        font-size: 13px;
      }
      #akai-quota-banner .qg-upgrade {
        background: #fff; color: #d63333;
      }
      #akai-quota-banner .qg-later {
        background: transparent; color: #fff;
        border: 1.5px solid rgba(255,255,255,.6);
      }
      @media (max-width: 600px) {
        #akai-quota-banner { bottom: 12px; padding: 10px 14px; font-size: 13px; }
      }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'akai-quota-banner';
    const pct = Math.round(u.localStoragePercent);
    banner.innerHTML = `
      <div class="qg-text">
        ⚠️ 儲存空間快滿了 <span class="qg-pct">${pct}%</span><br>
        建議升級到 IndexedDB（解 5MB 限制）
      </div>
      <button class="qg-upgrade" type="button">💪 立刻升級</button>
      <button class="qg-later" type="button">稍後再說</button>
    `;
    document.body.appendChild(banner);
    banner.querySelector('.qg-upgrade').onclick = () => {
      window.location.href = 'backup.html#upgrade';
      banner.remove();
    };
    banner.querySelector('.qg-later').onclick = () => banner.remove();
  });
})();
