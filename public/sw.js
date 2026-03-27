/* Arithmo compatibility service worker.
   This exists to avoid /sw.js 404 and to clean up stale registrations. */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (_) {
        // Ignore cache cleanup errors.
      }

      try {
        await self.registration.unregister();
      } catch (_) {
        // Ignore unregister errors.
      }

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        client.navigate(client.url);
      }
    })()
  );
});
