// Service worker : coquille de l'application en cache pour un démarrage instantané
// et un affichage même hors connexion. L'API n'est jamais mise en cache.
const VERSION = "gm-v4";
const SHELL = ["/", "/style.css", "/js/app.js", "/js/ingredients.js", "/js/catalog.js", "/icon.svg", "/icon-180.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return; // toujours le réseau
  if (e.request.mode === "navigate") {
    // réseau d'abord, coquille en secours
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put("/", copy)); return r; }).catch(() => caches.match("/")));
    return;
  }
  // fichiers de l'application : réseau d'abord (toujours à jour), cache seulement hors connexion
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
});
