// Service worker: permite abrir la app sin conexión (solo la interfaz, no los datos).
//
// Estrategia:
//  - Archivos de la app: primero la red (así siempre ves la última versión) y, si no hay
//    conexión, la copia guardada.
//  - Fuentes de Google: la copia guardada primero (no cambian).
//  - /api: nunca se cachea. Los gastos siempre vienen del servidor.
//
// Si cambiás la lista de archivos, subí el número de versión.
const CACHE = 'mis-gastos-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './js/app.js',
  './js/api.js',
  './js/categories.js',
  './js/charts.js',
  './js/dates.js',
  './js/format.js',
  './js/install.js',
  './js/state.js',
  './js/ui.js',
  './js/screens/admin.js',
  './js/screens/auth.js',
  './js/screens/budget-form.js',
  './js/screens/change-password.js',
  './js/screens/expense-form.js',
  './js/screens/income-form.js',
  './js/screens/incomes.js',
  './js/screens/obligation.js',
  './js/screens/plan.js',
  './js/screens/recurring-form.js',
  './js/screens/recurring.js',
  './js/screens/home.js',
  './js/screens/movements.js',
  './js/screens/settings.js',
  './js/screens/statistics.js',
  './js/screens/voice.js',
  './js/voice/expense-parser.js',
  './js/voice/speech-recognition-service.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('./index.html');
    throw new Error('Sin conexión y sin copia guardada');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
