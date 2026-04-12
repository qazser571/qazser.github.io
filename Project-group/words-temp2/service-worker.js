const CACHE_NAME = "word-app-v1";

/* ---------- install ---------- */

self.addEventListener("install", e => {

    self.skipWaiting();

    e.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll([
                "./",
                "./index.html",
                "./app/",
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

    const url = new URL(e.request.url);

    const isAppRequest = url.searchParams.get("mode") === "app";

    /* =========================
        WEB MODE → 캐시 사용 금지
    ========================= */

    if (!isAppRequest && e.request.destination === "document") {
        e.respondWith(fetch(e.request));
        return;
    }

    /* =========================
        APP MODE → 캐시 사용
    ========================= */

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