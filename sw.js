/* Service worker for the OT-AI study site.
   App-shell cache-first; runtime cache for Google Fonts. Offline-capable. */
var CACHE = "ot-ai-v1";
var SHELL = [
  "./",
  "index.html", "study.html", "feeder-monitor.html", "project.html",
  "learn.html", "docs.html", "apprenticeship.html",
  "styles.css", "app.js",
  "study.js", "study-data.js", "knowledge-gen.js",
  "aptitude.js", "aptitude-data.js",
  "manifest.webmanifest", "icon.svg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll fails the whole install if any 404s; add individually and ignore misses
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) { return caches.delete(k); } }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") { return; }
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isFont = url.host.indexOf("fonts.googleapis.com") !== -1 || url.host.indexOf("fonts.gstatic.com") !== -1;

  if (sameOrigin) {
    // cache-first for app shell/assets, fall back to network, then to cached index for navigations
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (resp) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return resp;
        }).catch(function () {
          if (req.mode === "navigate") { return caches.match("index.html"); }
        });
      })
    );
    return;
  }

  if (isFont) {
    // runtime cache-on-fetch for cross-origin fonts (opaque responses)
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (resp) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return resp;
        }).catch(function () { return hit; });
      })
    );
  }
});
