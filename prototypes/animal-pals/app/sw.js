// App shell offline; photos cached as they are seen so favourites work without internet.
const SHELL = 'ap-shell-v11', IMG = 'ap-img-v1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'videos.js', 'data-ta.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
// Drop older app caches (an earlier version kept sound clips there, which Safari can't play).
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== IMG).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Leave sound and video to the browser: Safari plays media only with byte-range (206) replies,
  // which a cached whole-file reply breaks, so the clips would stay silent.
  if (e.request.headers.has('range') || /^(audio|video)$/.test(e.request.destination) || /\/audio\//.test(u.pathname)) return;
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(SHELL).then(s => s.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
  } else if (/inaturalist-open-data|static\.inaturalist/.test(u.host) && e.request.destination === 'image') {
    e.respondWith(caches.open(IMG).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
  }
});
