// 99xmatka web app service worker.
// - Offline: if a page can't load because there is no internet, show /offline.html instead of
//   the browser's error page. Nothing else is cached, so players always get the latest site.
// - Phone notifications: show messages sent by the server (web push) and open the app when tapped.
const CACHE = '99x-offline-v1';
const OFFLINE_FILES = ['/offline.html', '/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.mode !== 'navigate') return; // only full page loads; API calls, images and scripts go straight to the network
  event.respondWith(fetch(req).catch(async () => {
    const cached = await caches.match('/offline.html');
    return cached || new Response('You are offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (e) { msg = { body: event.data ? event.data.text() : '' }; }
  const title = msg.title || '99xmatka';
  event.waitUntil(self.registration.showNotification(title, {
    body: msg.body || '',
    icon: msg.icon || '/icons/icon-192.png',
    badge: msg.badge || '/icons/badge-96.png',
    tag: msg.tag || undefined,
    data: { url: msg.url || '/' },
    vibrate: [80, 40, 80]
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find(w => new URL(w.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      if (url.includes('open=notifications')) open.postMessage({ type: 'open-notifications' });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
