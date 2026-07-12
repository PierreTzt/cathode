// Service worker MonSuivi : installabilité PWA + coquille réseau-first + Web Push.
// Le scope suit l'emplacement du fichier (racine ou /monsuivi/ derrière Caddy),
// donc toutes les URLs relatives sont résolues contre self.registration.scope.
const CACHE = "monsuivi-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// Réseau d'abord ; repli sur le cache pour les GET déjà vus (assets).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const titre = data.titre || "MonSuivi";
  const options = {
    body: data.corps || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: data.url || "." },
  };
  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL(
    (event.notification.data && event.notification.data.url) || ".",
    self.registration.scope
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(cible);
    })
  );
});
