/* ===================== SERVICE WORKER ===================== */

const CACHE_NAME = "word-app";

/* ---------- 최초 설치 ---------- */

self.addEventListener("install", e => {

    self.skipWaiting();

});

/* ---------- 활성화 ---------- */

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

/* ---------- FETCH 전략 ---------- */

self.addEventListener("fetch", e => {

    if (e.request.method !== "GET") return;

    /* ⭐ HTML은 항상 최신 (가장 중요) */
    if (e.request.destination === "document") {

        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );

        return;
    }

    /* ⭐ Stale-While-Revalidate */
    e.respondWith(

        caches.match(e.request).then(cached => {

            const networkFetch = fetch(e.request)
                .then(res => {

                    if (!res || res.status !== 200) return res;

                    const copy = res.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(e.request, copy));

                    return res;
                })
                .catch(() => cached);

            return cached || networkFetch;

        })

    );

});