// Caches the static shell only. Data always needs a connection: cross-origin requests
// (Supabase, the autofill function), non-GET requests and failed responses are never touched.
// Bump CACHE when this file changes; activate deletes every other cache.
const CACHE = 'shell-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function store(request, response) {
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    // Built files have hashed names, so a cached copy never goes stale.
    event.respondWith(
      caches
        .match(request)
        .then((hit) => hit ?? fetch(request).then((res) => store(request, res)))
        .catch(() => Response.error()),
    );
  } else {
    event.respondWith(
      fetch(request)
        .then((res) => store(request, res))
        .catch(() => caches.match(request).then((hit) => hit ?? Response.error())),
    );
  }
});
