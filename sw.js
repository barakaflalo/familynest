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
const VERSION = 'familynest-v2';
const CORE = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'privacy_policy.html'];
const ROOT = new URL('./', self.registration.scope).pathname;

self.addEventListener('install', e => {
  // one file at a time: a single failure must not leave the cache empty
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
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
