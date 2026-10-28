// Offline shell for session mode. Static assets: cache first. Session pages and card data: network
// first, falling back to the last copy. Nothing is cached for any other route.
const STATIC = "aftersong-static-v1";
const PAGES = "aftersong-pages-v1";

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/hero.webp") {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  const isSession = req.mode === "navigate" && (/^\/session\//.test(url.pathname) || /^\/sample\/[^/]+\/session$/.test(url.pathname));
  const isCardData = /^\/api\/(cards\/[^/]+|sample\/residents\/[^/]+\/card)$/.test(url.pathname);
  if (isSession || isCardData) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.open(PAGES).then((c) => c.match(req)).then((hit) => hit || Response.error())),
    );
  }
});
