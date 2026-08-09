/* REDUE Studio — this app does not use offline caching.
 * Serves 200 at /sw.js so stale browser registrations stop logging 404,
 * then unregisters itself and clears any leftover caches. */
self.addEventListener('install', (event) => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.map((key) => caches.delete(key)));
			await self.registration.unregister();
			const clients = await self.clients.matchAll({ type: 'window' });
			for (const client of clients) {
				if ('navigate' in client) {
					try {
						await client.navigate(client.url);
					} catch {
						/* ignore navigate failures */
					}
				}
			}
		})(),
	);
});
