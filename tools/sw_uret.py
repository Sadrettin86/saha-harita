import os, json, hashlib
kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dosyalar = ['./']
h = hashlib.sha1()
for d, _, fs in os.walk(kok):
    r = os.path.relpath(d, kok)
    if r.startswith('.git') or r.startswith('tools'): continue
    for f in sorted(fs):
        yol = os.path.relpath(os.path.join(d, f), kok)
        if yol in ('sw.js', 'README.md') or yol.startswith('.') or 'LICENSE' in yol or 'LICENCE' in yol: continue
        dosyalar.append(yol)
        h.update(open(os.path.join(kok, yol), 'rb').read())
dosyalar.sort()
surum = 'saha-harita-' + h.hexdigest()[:10]
sw = """/* Saha Haritası — çevrimdışı çalışma için servis çalışanı.
   Bu dosya derleme betiğiyle üretilir; SURUM uygulama dosyaları değişince değişir. */
var SURUM = %s;
var DOSYALAR = %s;

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(SURUM).then(function(c){ return c.addAll(DOSYALAR); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(adlar){
    return Promise.all(adlar.filter(function(a){ return a.indexOf('saha-harita-') === 0 && a !== SURUM; })
                            .map(function(a){ return caches.delete(a); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* Uygulama dosyaları önbellekten gelir (internetsiz açılır).
   Harita zemini gibi başka sunuculardaki istekler olduğu gibi ağa gider. */
self.addEventListener('fetch', function(e){
  var istek = e.request;
  if(istek.method !== 'GET') return;
  var url = new URL(istek.url);
  if(url.origin !== self.location.origin) return;
  if(istek.mode === 'navigate'){
    e.respondWith(caches.match('./', { ignoreSearch: true }).then(function(r){ return r || fetch(istek); }));
    return;
  }
  e.respondWith(caches.match(istek, { ignoreSearch: true }).then(function(r){
    return r || fetch(istek);
  }));
});
""" % (json.dumps(surum), json.dumps(dosyalar, indent=2, ensure_ascii=False))
open(os.path.join(kok, 'sw.js'), 'w').write(sw)
print(surum, len(dosyalar), 'dosya')
