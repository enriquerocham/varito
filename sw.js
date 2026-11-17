// Service worker de Varito: permite instalar la app y abrirla aunque falle el internet.
// Las páginas se piden primero a internet (para tener siempre la versión nueva) y,
// si no hay conexión, se usa la copia guardada. Los datos los maneja Firestore.
const VERSION = 'varito-v1';
const BASICOS = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './%C3%8DCONO.png', './LOGO_HORIZONTAL.png', './LOGO_CUADRADO.png', './MARCA_DE_AGUA.png',
];
const EXTERNOS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: primero internet, si falla la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copia = res.clone();
        caches.open(VERSION).then(c => c.put(req, copia));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Imágenes y archivos propios, fuentes, íconos y la librería de Firebase:
  // se responde con la copia guardada y se actualiza en segundo plano
  if (url.origin === location.origin || EXTERNOS.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSION).then(c => c.match(req).then(guardada => {
        const red = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        }).catch(() => guardada);
        return guardada || red;
      }))
    );
  }
  // Todo lo demás (datos de Firestore, WhatsApp, etc.) pasa directo
});
