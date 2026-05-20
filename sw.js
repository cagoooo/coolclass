/* 阿凱老師的教室小幫手｜Service Worker
 * 策略：network-first，離線時 fallback 到 cache
 * 更新版本號就能強制重新快取
 */
const VERSION = 'akai-classroom-v2.0.0';
const CACHE = VERSION;

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
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // 跨域請求（如 Google Fonts）走 cache-first
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }
  // 同源走 network-first
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
  );
});
