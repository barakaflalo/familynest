/* ── AppNest · Cloudflare Pages fix (Oct 2026) ──
   Cloudflare redirects *.html to clean URLs (/index.html -> /). Chrome refuses a
   "redirected" response that a Service Worker hands to a page load (ERR_FAILED).
   This strips the redirect flag from every response the SW fetches or reads from cache. */
(function(){
  var NB={101:1,204:1,205:1,304:1};
  function clean(r){
    if(!r||!r.redirected||NB[r.status])return r;
    return r.blob().then(function(b){return new Response(b,{status:r.status,statusText:r.statusText,headers:r.headers});});
  }
  var _fetch=self.fetch.bind(self);
  self.fetch=function(input,init){
    if(input&&typeof input==='object'&&input.mode==='navigate')input=input.url;
    return _fetch(input,init).then(clean);
  };
  var cm=Cache.prototype.match;
  Cache.prototype.match=function(){return cm.apply(this,arguments).then(clean);};
  var sm=CacheStorage.prototype.match;
  CacheStorage.prototype.match=function(){return sm.apply(this,arguments).then(clean);};
})();

/* FamilyNest service worker — network-first for pages (never a bare error), cache-first for files */
const VERSION = 'familynest-v4';
const CORE = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'privacy_policy.html'];
// 1.2 drawn art (~2.4 MB) — cached on install so the pictures work offline too
const ART = ["av-bear-joy.webp", "av-bear.webp", "av-cat-joy.webp", "av-cat.webp", "av-dog-joy.webp", "av-dog.webp", "av-fox-joy.webp", "av-fox.webp", "av-frog-joy.webp", "av-frog.webp", "av-koala-joy.webp", "av-koala.webp", "av-lion-joy.webp", "av-lion.webp", "av-monkey-joy.webp", "av-monkey.webp", "av-octopus-joy.webp", "av-octopus.webp", "av-owl-joy.webp", "av-owl.webp", "av-panda-joy.webp", "av-panda.webp", "av-penguin-joy.webp", "av-penguin.webp", "av-rabbit-joy.webp", "av-rabbit.webp", "av-tiger-joy.webp", "av-tiger.webp", "av-turtle-joy.webp", "av-turtle.webp", "av-unicorn-joy.webp", "av-unicorn.webp", "card-back.webp", "die-1.webp", "die-2.webp", "die-3.webp", "die-4.webp", "die-5.webp", "die-6.webp", "mem-animals-00.webp", "mem-animals-01.webp", "mem-animals-02.webp", "mem-animals-03.webp", "mem-animals-04.webp", "mem-animals-05.webp", "mem-animals-06.webp", "mem-animals-07.webp", "mem-animals-08.webp", "mem-animals-09.webp", "mem-animals-10.webp", "mem-animals-11.webp", "mem-food-00.webp", "mem-food-01.webp", "mem-food-02.webp", "mem-food-03.webp", "mem-food-04.webp", "mem-food-05.webp", "mem-food-06.webp", "mem-food-07.webp", "mem-food-08.webp", "mem-food-09.webp", "mem-food-10.webp", "mem-food-11.webp", "mem-ride-00.webp", "mem-ride-01.webp", "mem-ride-02.webp", "mem-ride-03.webp", "mem-ride-04.webp", "mem-ride-05.webp", "mem-ride-06.webp", "mem-ride-07.webp", "mem-ride-08.webp", "mem-ride-09.webp", "mem-ride-10.webp", "mem-ride-11.webp", "mem-sea-00.webp", "mem-sea-01.webp", "mem-sea-02.webp", "mem-sea-03.webp", "mem-sea-04.webp", "mem-sea-05.webp", "mem-sea-06.webp", "mem-sea-07.webp", "mem-sea-08.webp", "mem-sea-09.webp", "mem-sea-10.webp", "mem-sea-11.webp", "pawn-blue.webp", "pawn-green.webp", "pawn-red.webp", "pawn-yellow.webp", "sl-choco.webp", "sl-crown.webp", "sl-flag.webp", "sl-flower.webp", "sl-frame-candy.webp", "sl-frame-classic.webp", "sl-frame-jungle.webp", "sl-frame-space.webp", "sl-head-green.webp", "sl-head-olive.webp", "sl-head-orange.webp", "sl-head-purple.webp", "sl-head-red.webp", "sl-head-yellow.webp", "sl-hole.webp", "sl-rocket.webp", "sl-star.webp", "tile-c4.webp", "tile-dots.webp", "tile-ludo.webp", "tile-mem.webp", "tile-sl.webp", "tile-ttt.webp"];
const ROOT = new URL('./', self.registration.scope).pathname;

self.addEventListener('install', e => {
  // one file at a time: a single failure must not leave the cache empty
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.concat(ART).map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function offlinePage() {
  const html = '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FamilyNest</title>'
    + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#070707;color:#f3efe4;font:18px system-ui,sans-serif;text-align:center">'
    + '<div><div style="font-size:64px">🎲</div><h1 style="color:#d4a940;font-size:26px">אין חיבור לאינטרנט</h1><p>FamilyNest ייפתח ברגע שהחיבור יחזור.<br><span style="opacity:.7">No internet connection right now.</span></p>'
    + '<button onclick="location.reload()" style="font:inherit;padding:12px 26px;border-radius:12px;border:0;background:#d4a940;color:#140f02;font-weight:700">נסה שוב · Retry</button></div></body></html>';
  return Promise.resolve(new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
}
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    const isRoot = url.origin === location.origin && (url.pathname === ROOT || url.pathname === ROOT + 'index.html');
    e.respondWith(
      Promise.race([fetch(req), timeout(4000)])
        .then(res => {
          if (res && res.ok && isRoot) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./', copy)).catch(() => {}); }
          return res;
        })
        .catch(() => caches.open(VERSION)
          .then(c => isRoot ? c.match('./') : c.match(req, { ignoreSearch: true }))
          .then(hit => hit || offlinePage()))
    );
    return;
  }
  if (url.origin === location.origin) {
    // same-origin files: cache first, then the network (and remember it)
    e.respondWith(caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()).catch(() => {}); return res; }))).catch(() => fetch(req)));
    return;
  }
  // fonts and the PeerJS library: network, keep a copy for offline use
  if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    e.respondWith(fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {}); } return res; })
      .catch(() => caches.match(req).then(hit => hit || Promise.reject(new Error('offline')))));
  }
});
