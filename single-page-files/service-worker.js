// ⚙️ Bump this version every time you change index.html, script.js, or style.css
const CACHE_VERSION = "v5-2025-11-12";
const CACHE_NAME = `attendance-cache-${CACHE_VERSION}`;

// ✅ List only static files to cache (do NOT cache localStorage data)
const FILES_TO_CACHE = [
    "/",                // main page
    "/index.html",
    "/style.css",
    "/script.js",
    "/icons/icon-192.png",  // optional icons if you have
    "/icons/icon-512.png"
];

// 🧩 Install - cache all static assets
self.addEventListener("install", (event) => {
    console.log("[SW] Installing new service worker:", CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(FILES_TO_CACHE))
            .then(() => self.skipWaiting()) // force activate right away
    );
});

// 🧹 Activate - clean up old caches
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating new service worker");
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => {
                    console.log("[SW] Removing old cache:", k);
                    return caches.delete(k);
                })
            )
        )
    );
    self.clients.claim(); // take control immediately
});

// 📦 Fetch handler
self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Skip non-GET requests and local files (like blob:, data:)
    if (req.method !== "GET" || req.url.startsWith("chrome-extension")) return;

    // Skip JSON or API calls (let them go to network)
    if (req.url.endsWith(".json") || req.url.includes("/api/")) return;

    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached file but update in background
                event.waitUntil(updateCache(req));
                return cachedResponse;
            }
            // Fetch and cache new file
            return fetch(req)
                .then((networkResponse) => {
                    updateCache(req, networkResponse.clone());
                    return networkResponse;
                })
                .catch(() => caches.match("/index.html")); // offline fallback
        })
    );
});

async function updateCache(request, response) {
    if (!response) response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response);
}
