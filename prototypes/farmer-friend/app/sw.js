// App shell offline; crop photos and the last weather reply are cached as they are seen.
const SHELL = 'ff-shell-v5', IMG = 'ff-img-v1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data-crops.js', 'data-crops-more-1.js', 'data-crops-more-2.js', 'data-crops-more-3.js', 'data-crops-more-4.js', 'media.js', 'media-inputs.js', 'videos.js', 'media-more-1.js', 'media-more-2.js', 'videos-more.js', 'captions-ta.js', 'data-compost.js', 'images.js', 'images-local.js', 'sources.js', 'data-ta-crops-1.js', 'data-ta-crops-2.js', 'data-ta-compost.js', 'i18n.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== IMG).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.pathname.includes('/img/')) {
    e.respondWith(caches.open(IMG).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  } else if (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(u.host)) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(SHELL).then(s => s.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
  } else if (/inaturalist-open-data|static\.inaturalist/.test(u.host)) {
    e.respondWith(caches.open(IMG).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; })));
  }
});
