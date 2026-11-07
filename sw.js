// sw.js — 「加到主畫面」用（2026-11-07）：網路優先、斷線才用快取，所以改版不會卡在舊版。
// 排行榜（Worker API）不經過這裡；題庫、引擎、頁面有連過一次就能離線開。
const CACHE = 'vcf-app-1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match(e.request, { ignoreSearch: true }))));
});
