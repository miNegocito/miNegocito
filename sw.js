/* =====================================================
   Service Worker — miNegocito PWA
   Estrategia:
   - HTML y navegación → network-first (para recibir actualizaciones)
   - Resto de recursos → cache-first (para funcionar offline)
   ===================================================== */

const CACHE_VERSION = 'minegocito-v1.5.4';
const CACHE_NAME = 'minegocito-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
];

/* ---------- INSTALACIÓN ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cachear uno por uno para no romper el install si algo falla
      for (const url of ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] No se pudo cachear:', url, err);
        }
      }
    })
  );
  // Activar el nuevo SW de inmediato
  self.skipWaiting();
});

/* ---------- ACTIVACIÓN ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('minegocito-') && key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Borrando caché antigua:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Tomar control de las pestañas abiertas sin recargar
  self.clients.claim();
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo manejamos GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignorar extensiones del navegador u otros orígenes no controlados
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  /* --- 1) Estrategia NETWORK-FIRST para HTML --- */
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  /* --- 2) Estrategia CACHE-FIRST para todo lo demás --- */
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

/* ---------- MENSAJES (opcional) ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});