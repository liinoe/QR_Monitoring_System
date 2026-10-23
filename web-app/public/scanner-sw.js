// Service worker for the ENTRANCE SCANNER page only (scope: /scanner).
//
// Purpose: lets the scanner page open even when the internet is down — e.g. the
// browser was refreshed or the PC restarted during an outage. Together with the
// offline mode in Scanner.jsx, the entrance keeps working without internet.
//
// How it works:
//   * Opening /scanner:  try the internet first (always the newest version);
//     if there's no connection, use the copy saved last time.
//   * The page's files (JavaScript, CSS, images from this website): saved the
//     first time they load, then reused when offline.
//   * Requests to the backend (Render) are NOT touched — offline mode in
//     Scanner.jsx handles those.
// Admin pages are outside this worker's scope, so they work exactly as before.

const CACHE = "qless-scanner-v1";
const PAGE_KEY = "/scanner";
const MAX_FILES = 40; // keep the saved files small (old versions are trimmed)

// Install: save the scanner page AND the files it needs (the JavaScript/CSS listed
// in the page), so it can open offline right away. Then take over immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const response = await fetch(PAGE_KEY, { cache: "no-store" });
        if (response.ok) {
          const html = await response.clone().text();
          await cache.put(PAGE_KEY, response);
          // Files like /assets/index-AB12cd.js and /assets/index-XY34ef.css
          const files = Array.from(new Set(html.match(/\/assets\/[^"'\s>]+/g) || []));
          await Promise.all(files.map((f) => cache.add(f).catch(() => {})));
        }
      } catch {
        // Offline during install — files will be saved the next time they load.
      }
      await self.skipWaiting();
    })()
  );
});

// Activate: delete caches from older versions of this worker.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("qless-scanner-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Removes the oldest saved files if there are too many (each deploy adds new ones).
async function trimCache(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_FILES;
  for (let i = 0; i < extra; i++) {
    if (new URL(keys[i].url).pathname !== PAGE_KEY) await cache.delete(keys[i]);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // backend / other sites: not handled here

  // Opening the scanner page: internet first, saved copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(PAGE_KEY, copy));
          }
          return response;
        })
        .catch(() => caches.match(PAGE_KEY).then((saved) => saved || Response.error()))
    );
    return;
  }

  // The page's own files: use the saved copy if there is one, otherwise download
  // and save it. (Built files have unique names per version, so this is safe.)
  event.respondWith(
    caches.match(request).then((saved) => {
      if (saved) return saved;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(async (cache) => {
            await cache.put(request, copy);
            await trimCache(cache);
          });
        }
        return response;
      });
    })
  );
});
