const CACHE_NAME = 'calcount-v14';
const urlsToCache = [
  './',
  './index.html',
  'manifest.json',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://raw.githubusercontent.com/jadu8184-lab/calcountglobal/refs/heads/main/Indian_Food_Nutrition_Processed.csv'
];

// 1. Install & Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// 2. Fetch Offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// 3. Clean Old Caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) return caches.delete(cacheName);
        })
      );
    })
  );
});

// ——— NEW: BACKGROUND SYNC ———
self.addEventListener('sync', event => {
  if (event.tag === 'sync-leaderboard') {
    console.log('[Service Worker] Syncing Leaderboard Data in background...');
    event.waitUntil(syncLeaderboardData());
  }
});

async function syncLeaderboardData() {
  return new Promise((resolve, reject) => {
    // Open the IndexedDB bridge
    const request = indexedDB.open('CalCountDB', 1);
    
    request.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sync-queue')) return resolve();
      
      const tx = db.transaction('sync-queue', 'readwrite');
      const store = tx.objectStore('sync-queue');
      const getAll = store.getAll();

      getAll.onsuccess = async () => {
        const items = getAll.result;
        for (const item of items) {
          try {
            // Push to Firebase using the REST API (since SW doesn't have Firebase SDK)
            await fetch(`https://cal-count-bc597-default-rtdb.firebaseio.com/leaderboard/${item.id}.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data)
            });
            // If successful, delete it from the offline queue
            db.transaction('sync-queue', 'readwrite').objectStore('sync-queue').delete(item.id);
            console.log('[Service Worker] Successfully synced data for', item.id);
          } catch(err) {
            console.error("[Service Worker] Sync failed, will retry later", err);
          }
        }
        resolve();
      };
    };
    request.onerror = () => reject();
  });
}
