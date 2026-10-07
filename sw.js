/* WatchFlow — service worker : l'appli s'ouvre même sans réseau.
   Les données (Supabase) ne sont jamais mises en cache ici : elles sont
   conservées par l'appli elle-même (cache local + file d'attente). */
const VERSION = 'watchflow-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'store.js', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return; // API : jamais en cache
  const sameOrigin = url.origin === location.origin;
  const isLib = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!sameOrigin && !isLib) return;
  // Stale-while-revalidate : réponse immédiate depuis le cache, mise à jour en arrière-plan.
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: false });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { net.catch(() => {}); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
    return new Response('', { status: 504 });
  }));
});
