const CACHE_NAME = "word-app-v1";

/* ================= install ================= */

self.addEventListener("install", e => {

    self.skipWaiting();

    e.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll([
                "./",
                "./index.html",
                "./page/wordSet-list.html",
                "./js/wordSet-list.js"
            ])
        )
    );

});

/* ================= activate ================= */

self.addEventListener("activate", e => {

    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            )
        ).then(() => self.clients.claim())
    );

});

/* ================= fetch ================= */

self.addEventListener("fetch", e => {

    if (e.request.method !== "GET") return;

    const url = new URL(e.request.url);
    const isApp = url.searchParams.get("mode") === "app";

    /* ---------- WEB MODE ---------- */
    if (!isApp && e.request.destination === "document") {
        e.respondWith(fetch(e.request));
        return;
    }

    /* ---------- APP MODE ---------- */
    e.respondWith(

        caches.match(e.request).then(cacheRes => {

            if (cacheRes) return cacheRes;

            return fetch(e.request).then(networkRes => {

                const copy = networkRes.clone();

                caches.open(CACHE_NAME)
                    .then(cache => cache.put(e.request, copy));

                return networkRes;
            });

        })

    );

});