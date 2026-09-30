/* Saha Haritası — çevrimdışı çalışma için servis çalışanı.
   Bu dosya derleme betiğiyle üretilir; SURUM uygulama dosyaları değişince değişir. */
var SURUM = "saha-harita-69241d26c4";
var DOSYALAR = [
  "./",
  "app.css",
  "app.js",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "vendor/leaflet-rotate/leaflet-rotate.js",
  "vendor/leaflet/images/layers-2x.png",
  "vendor/leaflet/images/layers.png",
  "vendor/leaflet/images/marker-icon-2x.png",
  "vendor/leaflet/images/marker-icon.png",
  "vendor/leaflet/images/marker-shadow.png",
  "vendor/leaflet/leaflet.css",
  "vendor/leaflet/leaflet.js",
  "vendor/markercluster/MarkerCluster.Default.css",
  "vendor/markercluster/MarkerCluster.css",
  "vendor/markercluster/leaflet.markercluster.js",
  "vendor/pdfjs/pdf.min.js",
  "vendor/pdfjs/pdf.worker.min.js",
  "vendor/pdfjs/standard_fonts/FoxitDingbats.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixed.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixedBold.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixedItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerif.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerifBold.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerifItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSymbol.pfb",
  "vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf",
  "vendor/pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf",
  "vendor/pdfjs/standard_fonts/LiberationSans-Italic.ttf",
  "vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf"
];

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
