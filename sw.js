// sw.js — 「加到主畫面」用（2026-11-07）：網路優先、斷線才用快取，所以改版不會卡在舊版。
// 排行榜（Worker API）不經過這裡；題庫、引擎、頁面有連過一次就能離線開。
const CACHE = 'vcf-app-1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/game/music/')) return;   // 音樂：Range 請求回 206，放進 Cache 會出錯，交給瀏覽器自己處理（2026-11-12）
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match(e.request, { ignoreSearch: true }))));
});
// 網頁通知（2026-11-13）：iOS 規定每個 push 都要顯示通知，不能默默吃掉
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Gomoku Rush', { body: d.body || '', data: { url: d.url || '/' }, tag: 'rush-test' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', location.origin).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async list => {
    const c = list.find(w => new URL(w.url).origin === location.origin);
    if (!c) return clients.openWindow(url);
    try { if (c.navigate) await c.navigate(url); else c.postMessage({ t: 'push-open', url }); }
    catch { c.postMessage({ t: 'push-open', url }); }
    return c.focus();
  }));
});
