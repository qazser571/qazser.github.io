const CACHE_NAME = "word-app-v1";

const ASSETS = [
    "./wordSet-list.html",
    "./css/wordSet-list.css",
    "./js/wordSet-list.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    e.waitUntil(clients.claim());
});

self.addEventListener("fetch", e => {
    if (e.request.method !== "GET") return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;

            return fetch(e.request).then(res => {
                if (!res || res.status !== 200 || res.type !== "basic") {
                    return res;
                }

                const copy = res.clone();

                caches.open(CACHE_NAME).then(cache => {
                    cache.put(e.request, copy);
                });

                return res;
            });
        })
    );
});
