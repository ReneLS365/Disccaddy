/* Build replaces both markers with a content-derived revision and every local asset. */
const PREFIX = 'dfl-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE_NAME = PREFIX + '__BUILD_ID__';
const PRECACHE = /* __PRECACHE__ */ [];
self.addEventListener('install', event => {
  // No skipWaiting: do not combine old pages with new lazy-loaded chunks.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(PRECACHE.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }))); }
    catch (error) { await caches.delete(CACHE_NAME); console.error('Offlineinstallation fejlede.', error); throw error; }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url), scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const relative = url.pathname.slice(scope.pathname.length);
  const key = request.mode === 'navigate' && !PRECACHE.includes(relative) ? new URL('index.html', scope).href : url.href;
  if (request.mode !== 'navigate' && !PRECACHE.includes(relative)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME), saved = await cache.match(key, { ignoreSearch: true });
    if (saved) return saved;
    return fetch(request);
  })());
});
