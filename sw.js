// Офлайн-кэш игры: файлы игры берутся из кэша, страница — из сети (чтобы обновления приходили сразу).
// Запросы к серверу островов (Supabase) и к связи игроков (PeerJS) не трогаем — только сеть.
const CACHE = 'ostrov-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const put = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // собранные файлы игры (в имени — отпечаток содержимого): сначала кэш
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  // страница: сначала сеть, без сети — сохранённая копия
  // без сети сохранённую игру показываем только на главной — служебные страницы (проверка связи) должны честно не открыться
  const home = /\/(index\.html)?$/.test(url.pathname);
  e.respondWith(fetch(req).then((res) => put(req, res)).catch(async () => (await caches.match(req)) || (home ? await caches.match('./index.html') : null) || Response.error()));
});
