// Nazwa cache dla aplikacji
const CACHE_NAME = 'route-guidance-v2';

// Plik do wyświetlania w trybie offline
const OFFLINE_URL = '/offline.html';

// Lista plików do zapisania w cache
const CACHE_URLS = [
  '/',
  '/offline.html',
  '/static/css/styles.css',
  '/static/js/map.js',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
  '/static/icons/maskable_icon.png',
  '/static/manifest.json',
  'https://cdn.replit.com/agent/bootstrap-agent-dark-theme.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Instalacja Service Workera
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache otwarty');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Aktywacja Service Workera (czyszczenie starych cache)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Przechwytywanie żądań sieciowych
self.addEventListener('fetch', (event) => {
  // Sprawdź, czy żądanie dotyczy API
  if (event.request.url.includes('/api/')) {
    // Strategia "network first, fallback to cache" dla żądań API
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Zapisz odpowiedź API w cache, jeśli jest poprawna
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // W przypadku błędu sieci, użyj wersji z cache
          return caches.match(event.request);
        })
    );
  } else {
    // Strategia "cache first, fallback to network" dla pozostałych zasobów
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request).then((fetchResponse) => {
            // Zapisz nowy zasób w cache
            if (fetchResponse && fetchResponse.status === 200) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return fetchResponse;
          });
        })
        .catch((error) => {
          console.error('Fetch failed:', error);
          // Dla żądań do plików HTML, w przypadku błędu zwróć stronę offline
          if (event.request.headers.get('Accept') && event.request.headers.get('Accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
        })
    );
  }
});