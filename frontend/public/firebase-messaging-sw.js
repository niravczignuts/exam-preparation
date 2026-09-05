// Background push handler (KAN-72) + offline caching & background sync
// (KAN-64) — all in one service worker, registered at scope "/". Two
// service workers can't safely share the same scope, so this file grew
// rather than adding a second one.
//
// Service workers are static files, not bundled by Vite, so the Firebase
// config below is duplicated rather than read from import.meta.env —
// Firebase's web config is not secret, only mirror the same values you put
// in frontend/.env (VITE_FIREBASE_*).
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDgqpWm7lMmkZ2UJngzw2ichy2ZbtG7qbY",
  authDomain: "exam-preparation-e3fad.firebaseapp.com",
  projectId: "exam-preparation-e3fad",
  storageBucket: "exam-preparation-e3fad.firebasestorage.app",
  messagingSenderId: "1079110780487",
  appId: "1:1079110780487:web:b14e0a4b9d2e08cee59362",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Exam Prep", {
    body: body || "",
    // No PNG icon asset exists yet (KAN-63 note) — SVG isn't reliably
    // supported for system notification icons, so this is left to the
    // browser's default until a real icon set is designed.
    data: payload.data || {},
  });
});

// KAN-46 AC3: deep-link to the relevant screen when a notification is tapped.
// notification_job.py sends every push with data.url set to the in-app route.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("navigate" in client && "focus" in client) {
          return client.navigate(url).then((navigated) => (navigated || client).focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// ---------------------------------------------------------------------------
// Offline caching (KAN-64). Runtime (stale-while-revalidate) caching rather
// than a hand-written precache list: Vite fingerprints asset filenames per
// build, so a hard-coded list would go stale the moment a new build ships.
// Each asset/page is cached the first time it's actually requested, then
// served from cache (refreshed in the background) on later loads/offline.
// ---------------------------------------------------------------------------
const CACHE_NAME = "exam-prep-shell-v1";
const CACHEABLE_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never serve stale API data offline

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html"))),
    );
    return;
  }

  if (CACHEABLE_DESTINATIONS.has(request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
  }
});

// ---------------------------------------------------------------------------
// Background sync (KAN-64) — the service worker can't reach the page's
// Supabase session, so it just tells any open tab to replay its queued
// settings/exam-stage writes (see src/lib/offlineQueue.ts).
// ---------------------------------------------------------------------------
self.addEventListener("sync", (event) => {
  if (event.tag !== "flush-pending-writes") return;
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      for (const client of clients) client.postMessage({ type: "flush-pending-writes" });
    }),
  );
});
