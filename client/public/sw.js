const CACHE_NAME = 'olympiad-tracker-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/styles.css',
  '/src/auth.jsx',
  '/src/api.js',
  '/src/dates.js',
  '/src/components/Icon.jsx',
  '/src/components/Modal.jsx',
  '/src/components/PasswordForm.jsx',
  '/src/components/SubjectChips.jsx',
  '/src/components/TextField.jsx',
  '/src/components/TickBox.jsx',
  '/src/pages/ChaptersTab.jsx',
  '/src/pages/Forms.jsx',
  '/src/pages/LearnersTab.jsx',
  '/src/pages/Login.jsx',
  '/src/pages/PlanTab.jsx',
  '/src/pages/ProgressTab.jsx',
  '/src/pages/Schedule.jsx',
  '/src/pages/Tracker.jsx',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-maskable.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((res) => res || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
      )
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      });
    })
  );
});
