/* ==============================
   Snakes & Ladders PWA Service Worker
   - Cache-first strategy
   - Update detection + prompt support + mobile compatibility
============================== */

const CACHE_NAME = "snl-3d-v9"; // ⬅️ bump on every deploy

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./images/die-1.png",
  "./images/die-2.png",
  "./images/die-3.png",
  "./images/die-4.png",
  "./images/die-5.png",
  "./images/die-6.png",
  "./images/board.png",
  "./images/red.png",
  "./images/green.png",
  "./images/wood.png",
  "./images/frame-wood.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./sounds/dice-roll.mp3",
  "./sounds/move.mp3",
  "./sounds/snake.mp3",
  "./sounds/ladder.mp3",
  "./sounds/win.mp3"
];

/* ==============================
   Install
============================== */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // IMPORTANT: do NOT call skipWaiting here.
  // New SW will sit in "waiting" until page asks it to activate.
});

/* ==============================
   Activate
============================== */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  // Take control of all clients
  self.clients.claim();
});

/* ==============================
   Fetch (cache-first)
============================== */

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached ||
      fetch(event.request).catch(() =>
        caches.match("./index.html")
      )
    )
  );
});

/* ==============================
   Listen for SKIP_WAITING message
============================== */

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
