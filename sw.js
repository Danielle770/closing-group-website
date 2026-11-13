/* The Closing Group — service worker.
   Makes the site installable as an app (Android shows the system install sheet) and is ready for push
   notifications later. It never serves stale pages: pages always come from the network, and the saved
   home page is used only when the visitor is offline. */
const VERSION = 'cg-sw-20261113a';
const OFFLINE = ['/', '/manifest.json', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(OFFLINE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: network first, saved home page only if offline. Everything else goes straight to the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(fetch(req).catch(() => caches.match('/').then((r) => r || Response.error())));
});

// Push notifications (for later): show the message, open its link when tapped.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'The Closing Group', {
    body: d.body || '',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    data: { url: d.url || '/' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.indexOf(url) > -1 && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
