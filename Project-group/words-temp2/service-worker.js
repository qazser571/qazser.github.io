const CACHE_NAME = "word-app-v1";

/* ---------- install ---------- */

self.addEventListener("install", e => {

    self.skipWaiting();

    e.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll([
                "./",
                "./index.html",
                "./page/wordSet-list.html"
            ])
        )
    );
});

/* ---------- activate ---------- */

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

/* ---------- fetch ---------- */

self.addEventListener("fetch", e => {

    if (e.request.method !== "GET") return;

    e.respondWith(
        fetch(e.request)
            .then(res => {

                const copy = res.clone();

                caches.open(CACHE_NAME)
                    .then(cache => cache.put(e.request, copy));

                return res;

            })
            .catch(() => caches.match(e.request))
    );
});