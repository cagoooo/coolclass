/* 教室小幫手｜Service Worker
 *
 * BUILD_VERSION 由 bump-version.sh 在部署前自動替換，
 * 保證每次部署 sw.js byte 都不同，瀏覽器必偵測為更新。
 *
 * 策略：
 *   HTML / version.json → network-first（永遠拿最新）
 *   同源 JS/CSS/圖片     → network-first（後備 cache）
 *   跨域資源（Google Fonts）→ cache-first
 *
 * activate 後 postMessage SW_ACTIVATED 通知所有 clients，
 * 配合 sw-update.js 顯示更新 banner。
 */
const BUILD_VERSION = "20260522-0944-e9e47bc";  // ← bump-version.sh 會替換這行
const CACHE = `akai-classroom-${BUILD_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './emotion.html',
  './todo.html',
  './cards.html',
  './attendance.html',
  './marquee.html',
  './picker.html',
  './timer.html',
  './grouper.html',
  './roster.html',
  './roster.js',
  './sw-update.js',
  './nav.js',
  './shortcuts.js',
  './akai-store.js',
  './empty-state.js',
  './manifest.json',
  './icon.svg',
  './version.json',
  './crayon.css',
  './tweaks.js',
  './onboarding.js',
  './attendance.js',
  './emotion-history.html',
  './backup.html',
  './report.html',
  './points.html',
  './bell.html',
  './student.html',
  './finance.html',
  './emotion-kiosk.html',
  './qr.html',
  './lottery.html',
  './rules.html',
  './gallery.html',
  './seating.html',
  './schedule.html',
  './birthday.html',
  './lunch.html',
  './contact.html',
  './behavior.html',
  './substitute.html',
  './field-trip.html',
  './lesson.html',
  './reading.html',
  './worksheet.html',
  './fitness.html',
  './metronome.html',
  './eco.html',
  './dictation.html',
  './feedback.html',
  './tutorial.html',
  './evaluation.html',
  './robots.txt',
  './sitemap.xml',
];

// ===== install: 預先快取核心檔 + skipWaiting =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(
        CORE_ASSETS.map(url => cache.add(url).catch(() => {}))
      ))
  );
  self.skipWaiting();
});

// ===== activate: 清舊 cache + claim + 廣播更新 =====
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 清掉其他版本的 cache
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    // 立刻接管所有 client
    await self.clients.claim();
    // 廣播給所有 client：SW 已更新
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(c => {
      try {
        c.postMessage({ type: 'SW_ACTIVATED', version: BUILD_VERSION });
      } catch (e) {}
    });
  })());
});

// ===== message: 收到 SKIP_WAITING 指令時跳過等待 =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ===== fetch: 分策略 =====
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // version.json: 永遠走網路（no-store），失敗才回 cache
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('version.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // HTML 與導航：network-first
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // 跨域：cache-first（不快取 opaque）
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // 同源其他資源（JS/CSS/圖片）：network-first
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
