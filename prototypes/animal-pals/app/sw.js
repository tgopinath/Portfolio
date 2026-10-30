// App shell offline; photos cached as they are seen so favourites work without internet.
const SHELL = 'ap-shell-v9', IMG = 'ap-img-v1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'videos.js', 'data-ta.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(SHELL).then(s => s.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
  } else if (/inaturalist-open-data|static\.inaturalist/.test(u.host) && e.request.destination === 'image') {
    e.respondWith(caches.open(IMG).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
  }
});
