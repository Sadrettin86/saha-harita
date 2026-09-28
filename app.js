/* =========================================================================
   Saha Haritası — telefon / tablet görüntüleyicisi
   PC'deki "Küçükçekmece Adres Haritası" aracının ürettiği telefon paketini
   (harita noktaları + hane PDF'leri) açar. Paket bu cihazın içinde saklanır;
   hiçbir veri sunucuya gönderilmez.
   ========================================================================= */
(function(){
  'use strict';

  var UYGULAMA_SURUM = '1.0.0';
  var DB_AD = 'saha-harita', DB_SURUM = 1;
  var db = null;

  function el(id){ return document.getElementById(id); }
  function kacis(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function norm(s){
    return String(s == null ? '' : s).replace(/[İIı]/g,'i').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g,'');
  }
  function bildir(m){
    var d = document.createElement('div');
    d.className = 'bildir'; d.textContent = m; document.body.appendChild(d);
    setTimeout(function(){ d.remove(); }, 2600);
  }
  function uyar(baslik, mesaj){
    var b = el('uyariBar');
    b.style.display = 'block';
    b.innerHTML = '<b>' + kacis(baslik) + '</b>' + kacis(mesaj);
  }
  window.addEventListener('error', function(e){
    if(e && e.target && e.target !== window && e.target.tagName) return;
    uyar('Sayfa hatası', (e && e.message ? e.message : 'bilinmeyen') + ' @' + (e && e.lineno ? e.lineno : '?'));
  }, true);

  /* ------------------------------------------------------------------
     IndexedDB: 'meta' deposunda paket (PDF'siz), 'pdf' deposunda belgeler
     ------------------------------------------------------------------ */
  function dbAc(){
    return new Promise(function(ok, red){
      if(!window.indexedDB){ red(new Error('Bu tarayıcı IndexedDB desteklemiyor')); return; }
      var r = indexedDB.open(DB_AD, DB_SURUM);
      r.onupgradeneeded = function(){
        var d = r.result;
        if(!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if(!d.objectStoreNames.contains('pdf')) d.createObjectStore('pdf');
      };
      r.onsuccess = function(){ ok(r.result); };
      r.onerror = function(){ red(r.error); };
    });
  }
  function dbAl(depo, anahtar){
    return new Promise(function(ok, red){
      var t = db.transaction(depo, 'readonly');
      var r = t.objectStore(depo).get(anahtar);
      r.onsuccess = function(){ ok(r.result); };
      r.onerror = function(){ red(r.error); };
    });
  }
  /* Paketi tek işlemde yaz: eski PDF'ler silinir, yenileri ve meta yazılır */
  function paketYaz(meta, pdfler){
    return new Promise(function(ok, red){
      var t = db.transaction(['meta','pdf'], 'readwrite');
      t.oncomplete = function(){ ok(); };
      t.onerror = function(){ red(t.error); };
      t.onabort = function(){ red(t.error || new Error('Kayıt iptal edildi (depolama dolu olabilir)')); };
      var p = t.objectStore('pdf');
      p.clear();
      Object.keys(pdfler).forEach(function(k){ p.put(pdfler[k], k); });
      t.objectStore('meta').put(meta, 'paket');
    });
  }
  function hepsiniSil(){
    return new Promise(function(ok, red){
      var t = db.transaction(['meta','pdf'], 'readwrite');
      t.oncomplete = function(){ ok(); };
      t.onerror = function(){ red(t.error); };
      t.objectStore('meta').clear();
      t.objectStore('pdf').clear();
    });
  }

  function base64Cevir(b64){
    var ikili = atob(b64), n = ikili.length, dizi = new Uint8Array(n);
    for(var i = 0; i < n; i++) dizi[i] = ikili.charCodeAt(i);
    return dizi.buffer;
  }

  /* ------------------------------------------------------------------
     Paket yükleme
     ------------------------------------------------------------------ */
  function paketDosyasiSecildi(dosya){
    if(!dosya) return;
    el('yukleniyor').classList.add('acik');
    el('yukleniyorYazi').textContent = 'Paket okunuyor…';
    dosya.text().then(function(metin){
      var p;
      try { p = JSON.parse(metin); }
      catch(e){ throw new Error('Dosya okunamadı — telefon paketi mi? (' + e.message + ')'); }
      if(!p || p.tur !== 'saha-harita-paket' || !p.noktalar){
        throw new Error('Bu dosya bir telefon paketi değil. PC aracında Dışa aktar → 📱 Telefon paketi ile hazırlayın.');
      }
      el('yukleniyorYazi').textContent = 'Belgeler kaydediliyor…';
      var pdfler = {};
      var kaynak = p.pdfler || {};
      Object.keys(kaynak).forEach(function(k){ pdfler[k] = base64Cevir(kaynak[k].veri); });
      var pdfBilgi = {};
      Object.keys(kaynak).forEach(function(k){ pdfBilgi[k] = { ad: kaynak[k].ad, sayfa: kaynak[k].sayfa }; });
      delete p.pdfler;
      p.pdfBilgi = pdfBilgi;
      p.yuklenme = new Date().toISOString();
      return paketYaz(p, pdfler).then(function(){ return p; });
    }).then(function(p){
      try { if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e){}
      el('yukleniyorYazi').textContent = 'Hazır · ' + p.noktalar.length + ' nokta';
      setTimeout(function(){ location.reload(); }, 400);
    }).catch(function(e){
      el('yukleniyor').classList.remove('acik');
      alert(e && e.message ? e.message : String(e));
    });
  }

  el('paketDosya').addEventListener('change', function(){
    var f = this.files && this.files[0];
    this.value = '';
    if(!f) return;
    if(window.__V && !confirm('Yeni paket yüklenecek. Şu anki paket ve belgeleri bu cihazdan silinir.\n\n' +
                              '"Yapıldı" işaretleri aynı hane listesi için korunur. Devam edilsin mi?')) return;
    paketDosyasiSecildi(f);
  });

  function karsilamaGoster(){
    el('karsilama').style.display = 'flex';
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var bagimsiz = window.navigator.standalone === true ||
                   (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if(!bagimsiz){
      el('anaEkranIpucu').style.display = 'block';
      el('anaEkranIpucu').innerHTML = ios
        ? 'İpucu: Safari\'de <b>Paylaş</b> → <b>Ana Ekrana Ekle</b> ile uygulama gibi açabilirsiniz.'
        : 'İpucu: Chrome menüsünden <b>Uygulamayı yükle</b> / <b>Ana ekrana ekle</b> ile uygulama gibi açabilirsiniz.';
    }
  }

  /* ------------------------------------------------------------------
     PDF görüntüleyici
     ------------------------------------------------------------------ */
  if(window.pdfjsLib){
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  }
  var pdf = { kayit:null, doc:null, buf:null, zoom:1, gorev:0 };
  var pdfOlaylar = { acildi:null, kapandi:null };

  function pdfKapat(){
    el('pdfPanel').classList.remove('acik');
    document.body.classList.remove('pdfAcik');
    if(pdf.doc){ try { pdf.doc.destroy(); } catch(e){} }
    pdf.doc = null; pdf.buf = null; pdf.kayit = null;
    el('pdfSayfalar').innerHTML = '';
    if(pdfOlaylar.kapandi) pdfOlaylar.kapandi();
  }

  function pdfCiz(){
    if(!pdf.doc) return Promise.resolve();
    var gorev = ++pdf.gorev;
    var kutu = el('pdfSayfalar');
    var genislik = Math.max(200, el('pdfIc').clientWidth - 16);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var tuvaller = [];
    var zinc = Promise.resolve();
    for(var i = 1; i <= pdf.doc.numPages; i++){
      (function(no){
        zinc = zinc.then(function(){
          if(gorev !== pdf.gorev) return;
          return pdf.doc.getPage(no).then(function(sayfa){
            if(gorev !== pdf.gorev) return;
            var vp1 = sayfa.getViewport({ scale: 1 });
            var cssEn = genislik * pdf.zoom;
            var olcek = cssEn / vp1.width;
            var px = olcek * dpr;
            /* iOS tuval sınırı (~16 milyon piksel) aşılmasın */
            var alan = vp1.width * px * vp1.height * px;
            if(alan > 14e6) px = Math.sqrt(14e6 / (vp1.width * vp1.height));
            var vp = sayfa.getViewport({ scale: px });
            var c = document.createElement('canvas');
            c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
            c.style.width = Math.floor(cssEn) + 'px';
            c.style.height = Math.floor(cssEn * vp1.height / vp1.width) + 'px';
            c.className = 'pdfSayfa';
            tuvaller.push(c);
            return sayfa.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          });
        });
      }(i));
    }
    return zinc.then(function(){
      if(gorev !== pdf.gorev) return;
      kutu.innerHTML = '';
      kutu.style.transform = '';
      tuvaller.forEach(function(c){ kutu.appendChild(c); });
      el('pdfZoomYazi').textContent = '%' + Math.round(pdf.zoom * 100);
    }).catch(function(e){
      if(gorev === pdf.gorev) kutu.innerHTML = '<div class="bosluk">PDF çizilemedi: ' + kacis(e && e.message ? e.message : e) + '</div>';
    });
  }

  function pdfZoom(yeni, merkezX, merkezY){
    var ic = el('pdfIc');
    var eski = pdf.zoom;
    yeni = Math.max(1, Math.min(4, yeni));
    if(Math.abs(yeni - eski) < 0.01) return;
    var r = ic.getBoundingClientRect();
    var mx = merkezX == null ? r.width / 2 : merkezX - r.left;
    var my = merkezY == null ? r.height / 2 : merkezY - r.top;
    var ox = ic.scrollLeft + mx, oy = ic.scrollTop + my;
    pdf.zoom = yeni;
    pdfCiz().then(function(){
      ic.scrollLeft = ox * (yeni / eski) - mx;
      ic.scrollTop  = oy * (yeni / eski) - my;
    });
  }

  function pdfDokunmaKur(){
    var ic = el('pdfIc'), kutu = el('pdfSayfalar');
    var bas = null, sonDokunma = 0;
    function mesafe(t){ var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx*dx + dy*dy); }
    ic.addEventListener('touchstart', function(e){
      if(e.touches.length === 2){
        var r = ic.getBoundingClientRect();
        var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        bas = { d: mesafe(e.touches), mx: mx, my: my, oran: 1 };
        kutu.style.transformOrigin = (ic.scrollLeft + mx - r.left) + 'px ' + (ic.scrollTop + my - r.top) + 'px';
      }else if(e.touches.length === 1){
        var simdi = Date.now();
        if(simdi - sonDokunma < 280){
          e.preventDefault();
          pdfZoom(pdf.zoom > 1.2 ? 1 : 2, e.touches[0].clientX, e.touches[0].clientY);
          sonDokunma = 0;
        }else sonDokunma = simdi;
      }
    }, { passive: false });
    ic.addEventListener('touchmove', function(e){
      if(!bas || e.touches.length !== 2) return;
      e.preventDefault();
      bas.oran = mesafe(e.touches) / bas.d;
      var z = Math.max(1, Math.min(4, pdf.zoom * bas.oran)) / pdf.zoom;
      kutu.style.transform = 'scale(' + z + ')';
    }, { passive: false });
    ic.addEventListener('touchend', function(e){
      if(!bas || e.touches.length > 0) return;
      var b = bas; bas = null;
      var hedef = pdf.zoom * b.oran;
      if(Math.abs(hedef - pdf.zoom) < 0.05 || (pdf.zoom === 1 && hedef < 1) || (pdf.zoom === 4 && hedef > 4)){
        kutu.style.transform = ''; return;
      }
      pdfZoom(hedef, b.mx, b.my);
    });
    /* iOS'ta sayfanın tamamının yakınlaşmasını engelle */
    document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
  }

  function pdfPaylas(){
    if(!pdf.buf || !pdf.kayit) return;
    var ad = 'Hane-' + (pdf.kayit.haneNo || 'belge') + '.pdf';
    var blob = new Blob([pdf.buf], { type: 'application/pdf' });
    try {
      var dosya = new File([blob], ad, { type: 'application/pdf' });
      if(navigator.canShare && navigator.canShare({ files: [dosya] })){
        navigator.share({ files: [dosya], title: ad }).catch(function(){});
        return;
      }
    } catch(e){}
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u; a.download = ad; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ a.remove(); URL.revokeObjectURL(u); }, 4000);
  }

  el('pdfKapat').onclick = pdfKapat;
  el('pdfPaylas').onclick = pdfPaylas;
  el('pdfArti').onclick = function(){ pdfZoom(pdf.zoom + 0.5); };
  el('pdfEksi').onclick = function(){ pdfZoom(pdf.zoom - 0.5); };
  pdfDokunmaKur();

  /* ------------------------------------------------------------------
     Saha uygulaması (PC aracının saha haritasıyla aynı mantık)
     ------------------------------------------------------------------ */
  function sahaBaslat(V){
    window.__V = V;
    var harita, katman, kumeVar = false, konumIsareti = null, konumDaire = null, benim = null, izId = null;
    var isaretler = {};
    var kayitHarita = {};   // kayıt id -> { k, n }
    V.konumsuz = V.konumsuz || [];
    V.noktalar.forEach(function(n){ n.kayitlar.forEach(function(k){ kayitHarita[k.id] = { k:k, n:n }; }); });
    V.konumsuz.forEach(function(k){ kayitHarita[k.id] = { k:k, n:null }; });

    var ZEMINLER = [
      { ad:'Sokak', sunucu:'esri',
        url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        atif:'Esri · HERE · Garmin · © OpenStreetMap katkıcıları', enFazla:19 },
      { ad:'Uydu', sunucu:'esri',
        url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        atif:'Esri · Maxar · Earthstar Geographics', enFazla:19 },
      { ad:'Sade', sunucu:'carto',
        url:'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        atif:'© OpenStreetMap katkıcıları · © CARTO', enFazla:20, altAlan:'abcd' },
      { ad:'OpenStreetMap', sunucu:'osm',
        url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        atif:'© OpenStreetMap katkıcıları', enFazla:19 }
    ];
    var zeminKatman = null, zeminIdx = 0, zeminDenendi = {};
    var durumFiltre = 'tumu';
    var mahalleKapali = {};
    var aramaMetni = '';
    var secili = {};

    function noktaTel(n){
      for(var i=0;i<n.kayitlar.length;i++) if(n.kayitlar[i].telNs || n.kayitlar[i].telUlus) return n.kayitlar[i];
      return null;
    }

    /* ---- durum saklama ---- */
    function durumlar(){
      try { return JSON.parse(localStorage.getItem(V.depoAnahtar) || '{}'); }
      catch(e){ return {}; }
    }
    function durumYaz(d){
      try { localStorage.setItem(V.depoAnahtar, JSON.stringify(d)); }
      catch(e){ bildir('Cihaz kaydedemedi (gizli mod olabilir)'); }
    }
    function kayitDurumu(kid){ return durumlar()[kid] === 'tamam' ? 'tamam' : 'bekliyor'; }
    function noktaDurumu(n){
      var d = durumlar(), t = 0;
      for(var i=0;i<n.kayitlar.length;i++){ if(d[n.kayitlar[i].id] === 'tamam') t++; }
      if(t === 0) return 'bekliyor';
      if(t === n.kayitlar.length) return 'tamam';
      return 'kismi';
    }
    function noktaRengi(dur){
      return dur === 'tamam' ? '#34C759' : (dur === 'kismi' ? '#FF9500' : '#FF3B30');
    }
    function stilVer(n){
      var s = secili[n.id];
      return {
        radius: s ? 12 : 10,
        fillColor: noktaRengi(noktaDurumu(n)),
        color: s ? '#111827' : (V.mahalleRenk[n.mahalle] || '#ffffff'),
        weight: s ? 5 : 3, opacity: 1, fillOpacity: 0.92
      };
    }

    /* ---- seçim (KML için) ---- */
    function secimAnahtar(){ return V.depoAnahtar + '_secim'; }
    function secimYukle(){
      try {
        var s = JSON.parse(localStorage.getItem(secimAnahtar()) || '{}');
        var temiz = {};
        V.noktalar.forEach(function(n){ if(s[n.id]) temiz[n.id] = true; });
        secili = temiz;
      } catch(e){ secili = {}; }
    }
    function secimYaz(){ try { localStorage.setItem(secimAnahtar(), JSON.stringify(secili)); } catch(e){} }
    function seciliListe(){ return V.noktalar.filter(function(n){ return !!secili[n.id]; }); }
    function secimDegistir(id){
      if(secili[id]) delete secili[id]; else secili[id] = true;
      var n = V.noktalar.filter(function(x){ return x.id === id; })[0];
      secimTopluAyarla(n ? [n] : [], null);
    }
    function secimBarGuncelle(){
      var n = seciliListe().length;
      var s = el('secSayi');
      if(s) s.textContent = n ? ('Seçili: ' + n + ' adres') : 'Seçili yok — KML görünen listeyi alır';
      var t = el('secTemizle');
      if(t) t.disabled = n === 0;
    }

    /* ---- sayaçlar ---- */
    function sayacGuncelle(){
      var d = durumlar(), toplam = 0, yapildi = 0;
      V.noktalar.forEach(function(n){
        n.kayitlar.forEach(function(k){ toplam++; if(d[k.id] === 'tamam') yapildi++; });
      });
      el('sT').textContent = toplam;
      el('sY').textContent = yapildi;
      el('sB').textContent = toplam - yapildi;
      el('sS').textContent = seciliListe().length;
    }

    /* ---- istatistik ---- */
    function yuzde(a, b){ return b ? '%' + Math.round(a / b * 100) : '—'; }
    function istatistikHesapla(){
      var d = durumlar();
      var s = { adres: V.noktalar.length, kayit: 0, secAdres: 0, secKayit: 0,
                kayitYapildi: 0, secKayitYapildi: 0, supheli: 0, secSupheli: 0,
                durum: { tamam:0, kismi:0, bekliyor:0 }, secDurum: { tamam:0, kismi:0, bekliyor:0 },
                disDurum: { tamam:0, kismi:0, bekliyor:0 }, mahalle: {}, mahalleAdlari: [] };
      V.noktalar.forEach(function(n){
        var dur = noktaDurumu(n), sec = !!secili[n.id], yap = 0;
        n.kayitlar.forEach(function(k){ if(d[k.id] === 'tamam') yap++; });
        s.kayit += n.kayitlar.length; s.kayitYapildi += yap; s.durum[dur]++;
        if(n.snf === 'supheli') s.supheli++;
        if(sec){
          s.secAdres++; s.secKayit += n.kayitlar.length; s.secKayitYapildi += yap; s.secDurum[dur]++;
          if(n.snf === 'supheli') s.secSupheli++;
        }else s.disDurum[dur]++;
        if(!s.mahalle[n.mahalle]){ s.mahalle[n.mahalle] = { adres:0, sec:0, tamam:0, kalan:0 }; s.mahalleAdlari.push(n.mahalle); }
        var m = s.mahalle[n.mahalle];
        m.adres++; if(sec) m.sec++; if(dur === 'tamam') m.tamam++; else m.kalan++;
      });
      s.mahalleAdlari.sort(function(a,b){ return a.localeCompare(b,'tr'); });
      return s;
    }
    function istatistikCiz(){
      var kutu = el('istIc'); if(!kutu) return;
      var s = istatistikHesapla(), h = '';
      h += '<div class="istKutu">' +
        '<div class="istK"><b style="color:#34C759">' + s.kayitYapildi + '</b><span>Yapıldı</span></div>' +
        '<div class="istK"><b style="color:#FF3B30">' + (s.kayit - s.kayitYapildi) + '</b><span>Kalan</span></div>' +
        '<div class="istK"><b style="color:#007AFF">' + s.kayit + '</b><span>Toplam kayıt</span></div></div>';
      h += '<div class="istBas">Mahalleye göre</div>';
      h += '<table class="istT"><thead><tr><th>Mahalle</th><th>Adres</th><th>Yapıldı</th><th>Kalan</th><th>Seçimde</th></tr></thead><tbody>';
      s.mahalleAdlari.forEach(function(m){
        var v = s.mahalle[m];
        h += '<tr><td><span style="color:' + (V.mahalleRenk[m] || '#007AFF') + '">●</span> ' + kacis(m) + '</td>' +
             '<td>' + v.adres + '</td><td>' + v.tamam + '</td><td>' + v.kalan + '</td><td>' + v.sec + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="istBas">Ziyaret durumu × KML seçimi</div>';
      h += '<table class="istT"><thead><tr><th>Adres durumu</th><th>Toplam</th><th>Seçimde</th><th>Dışında</th><th>Oran</th></tr></thead><tbody>';
      [['Yapıldı','tamam','#34C759'],['Kısmen yapıldı','kismi','#FF9500'],['Yapılmadı','bekliyor','#FF3B30']].forEach(function(r){
        h += '<tr><td><span style="color:' + r[2] + '">●</span> ' + r[0] + '</td><td>' + s.durum[r[1]] + '</td>' +
             '<td><b>' + s.secDurum[r[1]] + '</b></td><td>' + s.disDurum[r[1]] + '</td>' +
             '<td class="yz">' + yuzde(s.secDurum[r[1]], s.durum[r[1]]) + '</td></tr>';
      });
      h += '<tr class="top"><td>Toplam adres</td><td>' + s.adres + '</td><td>' + s.secAdres + '</td>' +
           '<td>' + (s.adres - s.secAdres) + '</td><td class="yz">' + yuzde(s.secAdres, s.adres) + '</td></tr>';
      if(s.supheli){
        h += '<tr><td>⚠️ Şüpheli konum</td><td>' + s.supheli + '</td><td>' + s.secSupheli + '</td>' +
             '<td>' + (s.supheli - s.secSupheli) + '</td><td class="yz">' + yuzde(s.secSupheli, s.supheli) + '</td></tr>';
      }
      h += '</tbody></table>';
      h += '<div class="istBas">Hızlı seçim (görünen noktalara uygulanır)</div>';
      h += '<div class="istHizli">' +
           '<button class="dg" data-hizli="yapilmayan">Yapılmayanları seç</button>' +
           '<button class="dg" data-hizli="yapilan">Yapılanları seç</button>' +
           '<button class="dg" data-hizli="supheli">Şüphelileri seç</button>' +
           '<button class="dg" data-hizli="ters">Seçimi tersine çevir</button>' +
           '<button class="dg" data-hizli="temizle">Tüm seçimi bırak</button>' +
           '<button class="dg vur" data-hizli="kml">KML ver</button></div>';
      kutu.innerHTML = h;
    }
    function hizliSecim(tur){
      var gorunen = V.noktalar.filter(gecerli);
      if(tur === 'temizle'){ secimTopluAyarla(seciliListe(), false); return; }
      if(tur === 'kml'){ kmlVer(); return; }
      if(tur === 'ters'){
        gorunen.forEach(function(n){ if(secili[n.id]) delete secili[n.id]; else secili[n.id] = true; });
        secimTopluAyarla(gorunen, null); return;
      }
      var liste = gorunen.filter(function(n){
        var dur = noktaDurumu(n);
        if(tur === 'yapilan') return dur === 'tamam';
        if(tur === 'yapilmayan') return dur !== 'tamam';
        if(tur === 'supheli') return n.snf === 'supheli';
        return false;
      });
      if(!liste.length){ bildir('Bu ölçüte uyan görünen nokta yok'); return; }
      secimTopluAyarla(liste, true);
      bildir(liste.length + ' adres seçime eklendi');
    }
    function secimTopluAyarla(liste, deger){
      liste.forEach(function(n){
        if(deger === true) secili[n.id] = true;
        else if(deger === false) delete secili[n.id];
        if(isaretler[n.id]){ isaretler[n.id].setStyle(stilVer(n)); isaretler[n.id].setPopupContent(baloncuk(n)); }
      });
      secimYaz(); secimBarGuncelle(); sayacGuncelle();
      if(el('panelListe').classList.contains('acik')) listeCiz();
      if(el('panelIst').classList.contains('acik')) istatistikCiz();
    }

    /* ---- baloncuk ---- */
    function telDugmeleri(k){
      var h = '';
      if(k.telNs){
        h += '<a class="telBtn" href="' + kacis(k.telNs) + '">📞 NetSipp · ' + kacis(k.tel) + '</a>';
        if(k.telUlus) h += '<a class="telAlt" href="tel:' + kacis(k.telUlus) + '">☎ Telefonla ara</a>';
      }else if(k.telUlus){
        h += '<a class="telBtn" href="tel:' + kacis(k.telUlus) + '">📞 ' + kacis(k.tel) + '</a>';
      }
      return h;
    }
    function baloncuk(n){
      var dur = noktaDurumu(n);
      var h = '<div class="pt">' + kacis(n.pinAd || (n.cadde + ' ' + n.kapi)) + '</div>';
      h += '<div class="pa">📍 ' + kacis(n.mahalle) + '</div>';
      if(n.snf === 'supheli') h += '<div class="pu">⚠️ Konum yaklaşık olabilir — sokakta teyit edin</div>';
      n.kayitlar.forEach(function(k){
        var kd = kayitDurumu(k.id);
        h += '<div class="kart">';
        if(k.ad) h += '<div class="ad">👤 ' + kacis(k.ad) + (k.daire ? ' <span style="color:#888;font-weight:400">D:' + kacis(k.daire) + '</span>' : '') + '</div>';
        else if(k.daire) h += '<div class="ad">🚪 Daire ' + kacis(k.daire) + '</div>';
        if(k.haneNo) h += '<div class="dt">🏠 Hane ' + kacis(k.haneNo) + (k.kisi ? ' · ' + kacis(k.kisi) + ' kişi' : '') + '</div>';
        if(k.yardim) h += '<div class="dt">🎁 ' + kacis(k.yardim) + '</div>';
        if(k.tarih)  h += '<div class="dt">📅 ' + kacis(k.tarih) + '</div>';
        h += k.pdf
          ? '<button class="pdfBtn" data-pdf="' + kacis(k.id) + '">📄 Belgeyi aç</button>'
          : '<div class="pdfYok">📄 Bu hanenin belgesi yok</div>';
        h += telDugmeleri(k);
        h += '<button class="yb ' + kd + '" data-kayit="' + kacis(k.id) + '" data-nokta="' + n.id + '">' +
             (kd === 'tamam' ? '↺ Geri al' : '✓ Yapıldı') + '</button>';
        h += '</div>';
      });
      if(n.kayitlar.length > 1){
        h += '<button class="yb ' + (dur === 'tamam' ? 'tamam' : 'bekliyor') + '" data-hepsi="' + n.id + '">' +
             (dur === 'tamam' ? '↺ Hepsini geri al' : '✓ Hepsini yapıldı işaretle') + '</button>';
      }
      h += '<button class="yb secBtn' + (secili[n.id] ? ' secik' : '') + '" data-sec="' + n.id + '">' +
           (secili[n.id] ? '★ KML seçiminden çıkar' : '☆ KML seçimine ekle') + '</button>';
      h += '<div class="yol">' +
           '<a href="https://www.google.com/maps/dir/?api=1&destination=' + n.lat + ',' + n.lng + '" target="_blank" rel="noopener">🧭 Google</a>' +
           '<a href="https://maps.apple.com/?daddr=' + n.lat + ',' + n.lng + '&dirflg=d" target="_blank" rel="noopener">🍎 Apple</a>' +
           '<a href="https://yandex.com.tr/harita/?rtext=~' + n.lat + ',' + n.lng + '&rtt=auto" target="_blank" rel="noopener">🚕 Yandex</a>' +
           '</div>';
      return h;
    }

    /* ---- PDF paneli ---- */
    function pdfEylemCiz(){
      var k = pdf.kayit; if(!k) return;
      var kd = kayitDurumu(k.id);
      var h = '';
      if(k.telNs) h += '<a class="dg vurY" href="' + kacis(k.telNs) + '">📞 NetSipp</a>';
      if(k.telUlus) h += '<a class="dg" href="tel:' + kacis(k.telUlus) + '">☎ ' + kacis(k.tel) + '</a>';
      h += '<button class="dg ' + (kd === 'tamam' ? 'vurY' : '') + '" data-kayit="' + kacis(k.id) + '"' +
           (kayitHarita[k.id] && kayitHarita[k.id].n ? ' data-nokta="' + kayitHarita[k.id].n.id + '"' : '') + '>' +
           (kd === 'tamam' ? '✓ Yapıldı' : 'Yapıldı işaretle') + '</button>';
      var r = kayitHarita[k.id];
      if(r && r.n && document.body.classList.contains('genis') === false){
        h += '<button class="dg" id="pdfHaritada">🗺 Haritada</button>';
      }
      el('pdfEylem').innerHTML = h;
      var hb = el('pdfHaritada');
      if(hb) hb.onclick = function(){ pdfKapat(); noktayaGit(r.n, true); };
    }

    function pdfAc(kid){
      var r = kayitHarita[kid]; if(!r) return;
      var k = r.k;
      pdf.kayit = k; pdf.zoom = 1; pdf.gorev++;
      el('pdfAd').textContent = k.ad || ('Hane ' + (k.haneNo || ''));
      el('pdfAlt').textContent = [k.haneNo ? 'Hane ' + k.haneNo : '', k.adres || (r.n ? r.n.pinAd + ', ' + r.n.mahalle : '')]
        .filter(Boolean).join(' · ');
      el('pdfSayfalar').innerHTML = '<div class="bosluk">Belge açılıyor…</div>';
      el('pdfZoomYazi').textContent = '%100';
      el('pdfPanel').classList.add('acik');
      document.body.classList.add('pdfAcik');
      el('pdfIc').scrollTop = 0; el('pdfIc').scrollLeft = 0;
      pdfEylemCiz();
      setTimeout(function(){ if(harita) harita.invalidateSize(); }, 60);
      if(!k.pdf){
        el('pdfSayfalar').innerHTML = '<div class="bosluk">Bu haneye ait PDF pakette yok.</div>';
        return;
      }
      if(!window.pdfjsLib){
        el('pdfSayfalar').innerHTML = '<div class="bosluk">PDF kütüphanesi yüklenemedi.</div>';
        return;
      }
      if(pdf.doc){ try { pdf.doc.destroy(); } catch(e){} pdf.doc = null; }
      dbAl('pdf', k.pdf).then(function(buf){
        if(pdf.kayit !== k) return;
        if(!buf) throw new Error('Belge bu cihazda bulunamadı — paketi yeniden yükleyin');
        pdf.buf = buf;
        return pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false,
                                      standardFontDataUrl: 'vendor/pdfjs/standard_fonts/' }).promise;
      }).then(function(doc){
        if(!doc) return;
        if(pdf.kayit !== k){ doc.destroy(); return; }
        pdf.doc = doc;
        return pdfCiz();
      }).catch(function(e){
        el('pdfSayfalar').innerHTML = '<div class="bosluk">Belge açılamadı: ' + kacis(e && e.message ? e.message : e) + '</div>';
      });
    }
    pdfOlaylar.kapandi = function(){ setTimeout(function(){ if(harita) harita.invalidateSize(); }, 60); };

    /* ---- tıklamalar (baloncuk, liste, PDF paneli) ---- */
    document.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b) return;
      if(b.dataset.pdf){ pdfAc(b.dataset.pdf); return; }
      if(b.dataset.sec){ secimDegistir(b.dataset.sec); return; }
      if(b.dataset.hizli){ hizliSecim(b.dataset.hizli); return; }
      var d = durumlar();
      if(b.dataset.kayit){
        d[b.dataset.kayit] = d[b.dataset.kayit] === 'tamam' ? 'bekliyor' : 'tamam';
        durumYaz(d); tazele(b.dataset.nokta);
        if(pdf.kayit && pdf.kayit.id === b.dataset.kayit) pdfEylemCiz();
      }else if(b.dataset.hepsi){
        var n = V.noktalar.filter(function(x){ return x.id === b.dataset.hepsi; })[0];
        if(!n) return;
        var hepsiTamam = noktaDurumu(n) === 'tamam';
        n.kayitlar.forEach(function(k){ d[k.id] = hepsiTamam ? 'bekliyor' : 'tamam'; });
        durumYaz(d); tazele(n.id);
      }
    });

    function tazele(noktaId){
      var n = noktaId && V.noktalar.filter(function(x){ return x.id === noktaId; })[0];
      if(n && isaretler[noktaId]){
        isaretler[noktaId].setStyle(stilVer(n));
        isaretler[noktaId].setPopupContent(baloncuk(n));
      }
      sayacGuncelle();
      if(el('panelListe').classList.contains('acik')) listeCiz();
      if(el('panelIst').classList.contains('acik')) istatistikCiz();
      filtreUygula();
    }

    /* ---- filtreler ---- */
    function aramaMetniKayit(k){ return [k.ad, k.yardim, k.daire, k.tel, k.haneNo, k.adres].join(' '); }
    function gecerli(n){
      if(mahalleKapali[n.mahalle]) return false;
      if(durumFiltre !== 'tumu'){
        var d = noktaDurumu(n);
        if(durumFiltre === 'tamam' && d !== 'tamam') return false;
        if(durumFiltre === 'bekliyor' && d === 'tamam') return false;
      }
      if(aramaMetni){
        var metin = norm([n.mahalle, n.cadde, n.kapi, n.pinAd, n.fa,
          n.kayitlar.map(aramaMetniKayit).join(' ')].join(' '));
        if(metin.indexOf(aramaMetni) === -1) return false;
      }
      return true;
    }
    function filtreUygula(){
      V.noktalar.forEach(function(n){
        var m = isaretler[n.id]; if(!m) return;
        var goster = gecerli(n), icinde = katman.hasLayer(m);
        if(goster && !icinde) katman.addLayer(m);
        if(!goster && icinde) katman.removeLayer(m);
      });
    }

    /* ---- liste ---- */
    function uzaklik(a, b){
      var R = 6371, dLat = (b[0]-a[0])*Math.PI/180, dLon = (b[1]-a[1])*Math.PI/180;
      var x = Math.sin(dLat/2)*Math.sin(dLat/2) +
              Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
    }
    function noktayaGit(n, baloncukAc){
      kapatPanel();
      harita.setView([n.lat, n.lng], 18);
      var m = isaretler[n.id];
      if(!m || !baloncukAc) return;
      if(!katman.hasLayer(m)) katman.addLayer(m);
      if(kumeVar && katman.zoomToShowLayer) katman.zoomToShowLayer(m, function(){ m.openPopup(); });
      else m.openPopup();
    }
    function listeCiz(){
      var kutu = el('listeIc');
      var liste = V.noktalar.filter(gecerli);
      if(benim){
        liste.forEach(function(n){ n._u = uzaklik(benim, [n.lat, n.lng]); });
        liste.sort(function(a,b){ return a._u - b._u; });
      }else{
        liste.forEach(function(n){ n._u = null; });
        liste.sort(function(a,b){ return (a.mahalle + a.cadde).localeCompare(b.mahalle + b.cadde, 'tr'); });
      }
      kutu.innerHTML = '';
      if(!liste.length) kutu.innerHTML = '<div class="bosluk">Filtreye uyan adres yok</div>';
      else{
        var sarmal = document.createElement('div'); sarmal.className = 'listeKutu';
        kutu.appendChild(sarmal);
        liste.slice(0, 400).forEach(function(n){
          var dur = noktaDurumu(n), tk = noktaTel(n);
          var pdfVar = n.kayitlar.some(function(k){ return !!k.pdf; });
          var s = document.createElement('div');
          s.className = 'satir' + (secili[n.id] ? ' secili' : '');
          s.innerHTML =
            '<span class="no" style="background:' + noktaRengi(dur) + '"></span>' +
            '<span class="bl"><span class="a1">' + kacis(n.pinAd) + '</span>' +
            '<span class="a2">' + kacis(n.mahalle) +
            (n.kayitlar.length > 1 ? ' · ' + n.kayitlar.length + ' kayıt' : '') +
            (n.kayitlar[0] && n.kayitlar[0].ad ? ' · ' + kacis(n.kayitlar[0].ad) : '') +
            (tk ? ' · ' + kacis(tk.tel) : '') + '</span></span>' +
            (n._u != null ? '<span class="uz">' + (n._u < 1 ? Math.round(n._u*1000) + ' m' : n._u.toFixed(1) + ' km') + '</span>' : '') +
            (pdfVar ? '<span class="pdfIkon" title="Belge">📄</span>' : '') +
            '<span class="sc">' + (secili[n.id] ? '★' : '☆') + '</span>';
          s.querySelector('.sc').onclick = function(ev){ ev.stopPropagation(); secimDegistir(n.id); };
          var pi = s.querySelector('.pdfIkon');
          if(pi) pi.onclick = function(ev){
            ev.stopPropagation();
            var k = n.kayitlar.filter(function(x){ return x.pdf; })[0];
            if(k) pdfAc(k.id);
          };
          s.onclick = function(){ noktayaGit(n, true); };
          sarmal.appendChild(s);
        });
        if(liste.length > 400){
          var u = document.createElement('div');
          u.className = 'bosluk'; u.textContent = '… ve ' + (liste.length - 400) + ' adres daha (arama ile daraltın)';
          kutu.appendChild(u);
        }
      }
      /* Konumu bulunamayan kayıtlar — haritada yok, belgeleri açılabilir */
      var ks = V.konumsuz.filter(function(k){ return !aramaMetni || norm(aramaMetniKayit(k)).indexOf(aramaMetni) !== -1; });
      if(ks.length){
        var bas = document.createElement('div'); bas.className = 'istBas';
        bas.textContent = 'Konumu bulunamayan · ' + ks.length;
        kutu.appendChild(bas);
        var sar2 = document.createElement('div'); sar2.className = 'listeKutu';
        kutu.appendChild(sar2);
        ks.forEach(function(k){
          var kd = kayitDurumu(k.id);
          var s = document.createElement('div'); s.className = 'satir';
          s.innerHTML = '<span class="no" style="background:' + noktaRengi(kd) + '"></span>' +
            '<span class="bl"><span class="a1">' + kacis(k.ad || ('Hane ' + k.haneNo)) + '</span>' +
            '<span class="a2">' + kacis(k.adres || '') + (k.tel ? ' · ' + kacis(k.tel) : '') + '</span></span>' +
            (k.pdf ? '<span class="pdfIkon">📄</span>' : '');
          s.onclick = function(){ pdfAc(k.id); };
          sar2.appendChild(s);
        });
      }
    }

    function mahalleCiz(){
      var kutu = el('mahalleIc'), adlar = [];
      V.noktalar.forEach(function(n){ if(adlar.indexOf(n.mahalle) === -1) adlar.push(n.mahalle); });
      adlar.sort(function(a,b){ return a.localeCompare(b,'tr'); });
      kutu.innerHTML = '';
      adlar.forEach(function(m){
        var c = document.createElement('div');
        c.className = 'cip' + (mahalleKapali[m] ? ' kapali' : '');
        c.innerHTML = '<i style="background:' + (V.mahalleRenk[m] || '#007AFF') + '"></i>' + kacis(m);
        c.onclick = function(){
          mahalleKapali[m] = !mahalleKapali[m];
          c.className = 'cip' + (mahalleKapali[m] ? ' kapali' : '');
          filtreIsaretiGuncelle(); filtreUygula();
        };
        kutu.appendChild(c);
      });
    }

    /* ---- KML (CoMaps için) ---- */
    function kmlRenk(hex){
      var h = String(hex || '#e6194B').replace('#','');
      return ('ff' + h.substring(4,6) + h.substring(2,4) + h.substring(0,2)).toLowerCase();
    }
    function kmlUret(liste){
      var stil = {}, i = 0, s = '';
      s += '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n';
      s += '  <name>&#8203;</name>\n';
      var mahalleler = [];
      liste.forEach(function(n){ if(mahalleler.indexOf(n.mahalle) === -1) mahalleler.push(n.mahalle); });
      mahalleler.forEach(function(m){
        stil[m] = 'mh' + (i++);
        s += '  <Style id="' + stil[m] + '"><IconStyle><color>' + kmlRenk(V.mahalleRenk[m]) + '</color>' +
             '<scale>1.05</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href>' +
             '</Icon></IconStyle><LabelStyle><scale>0.85</scale></LabelStyle></Style>\n';
      });
      liste.forEach(function(n){
        var tk = noktaTel(n);
        var d = n.kayitlar.map(function(k){
          var h = '';
          if(k.ad) h += '<div><b>' + kacis(k.ad) + '</b></div>';
          if(k.kimlik) h += '<div><a style="color:inherit;text-decoration:none;pointer-events:none;' +
                            '-webkit-touch-callout:none">' + kacis(k.kimlik) + '</a></div>';
          if(k.tel){
            var ikon = k.telUlus ? '<a href="tel:' + kacis(k.telUlus) + '">☎</a>' : '☎';
            var numara = k.telNs ? '<a href="' + kacis(k.telNs) + '">' + kacis(k.tel) + '</a>'
                       : (k.telUlus ? '<a href="tel:' + kacis(k.telUlus) + '">' + kacis(k.tel) + '</a>' : kacis(k.tel));
            h += '<div>' + ikon + ' ' + numara + '</div>';
          }
          return h;
        }).filter(Boolean).join('<div>&#160;</div>').replace(/\]\]>/g, ']]&gt;');
        s += '  <Placemark>\n    <name>' + kacis(n.pinAd) + '</name>\n' +
             (d ? '    <description><![CDATA[' + d + ']]></description>\n' : '') +
             (tk ? '    <phoneNumber>' + kacis(tk.telUlus) + '</phoneNumber>\n' : '') +
             (stil[n.mahalle] ? '    <styleUrl>#' + stil[n.mahalle] + '</styleUrl>\n' : '') +
             '    <Point><coordinates>' + n.lng + ',' + n.lat + ',0</coordinates></Point>\n  </Placemark>\n';
      });
      return s + '</Document>\n</kml>\n';
    }
    function dosyaAdiTemiz(s){
      var tr = { 'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U' };
      return String(s).replace(/[çÇğĞıİöÖşŞüÜ]/g, function(c){ return tr[c] || c; })
        .replace(/[—–]/g, '-').replace(/[^A-Za-z0-9 ._()-]/g, '-').replace(/-{2,}/g, '-')
        .replace(/\s+/g, ' ').replace(/[.\s-]+$/, '').trim().slice(0, 90) || 'harita';
    }
    function dosyaVer(ad, metin, tur){
      var blob = new Blob([metin], { type: tur });
      try {
        var dosya = new File([blob], ad, { type: tur });
        if(navigator.canShare && navigator.canShare({ files: [dosya] })){
          navigator.share({ files: [dosya], title: ad }).catch(function(){});
          return;
        }
      } catch(e){}
      var u = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = u; a.download = ad; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ a.remove(); URL.revokeObjectURL(u); }, 2000);
    }
    function kmlVer(){
      var liste = seciliListe(), kaynak = 'seçilen';
      if(!liste.length){ liste = V.noktalar.filter(gecerli); kaynak = 'görünen'; }
      if(!liste.length){ bildir('Aktarılacak nokta yok'); return; }
      dosyaVer(dosyaAdiTemiz(V.baslik + (kaynak === 'seçilen' ? ' (secim)' : '')) + '.kml',
               kmlUret(liste), 'application/vnd.google-earth.kml+xml');
      bildir(liste.length + ' ' + kaynak + ' adres → KML');
    }

    /* ---- paneller ---- */
    var PANELLER = ['panelListe','panelMahalle','panelKatman','panelIst','panelPaket'];
    function kapatPanel(){
      PANELLER.forEach(function(id){ el(id).classList.remove('acik'); });
      el('perdeSheet').classList.remove('acik');
      document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('etkin'); });
      el('dgHarita').classList.add('etkin');
    }
    window.kapatPanel = kapatPanel;
    function panelAc(panelId, tabId){
      var zatenAcik = el(panelId).classList.contains('acik');
      kapatPanel();
      if(zatenAcik) return false;
      el(panelId).classList.add('acik');
      el('perdeSheet').classList.add('acik');
      el('dgHarita').classList.remove('etkin');
      if(tabId) el(tabId).classList.add('etkin');
      return true;
    }
    function filtreIsaretiGuncelle(){
      var aktif = durumFiltre !== 'tumu' || Object.keys(mahalleKapali).some(function(m){ return mahalleKapali[m]; });
      el('dgMahalle').classList.toggle('isaretli', aktif);
    }

    /* ---- paket bilgisi ---- */
    function tarihYaz(iso){
      if(!iso) return '—';
      var t = new Date(iso);
      if(isNaN(t)) return iso;
      function p(x){ return String(x).padStart(2,'0'); }
      return p(t.getDate()) + '.' + p(t.getMonth()+1) + '.' + t.getFullYear() + ' ' + p(t.getHours()) + ':' + p(t.getMinutes());
    }
    function paketCiz(){
      var kayit = 0, pdfli = 0;
      V.noktalar.forEach(function(n){ n.kayitlar.forEach(function(k){ kayit++; if(k.pdf) pdfli++; }); });
      V.konumsuz.forEach(function(k){ if(k.pdf) pdfli++; });
      var h = '<table class="istT">' +
        '<tr><td>Liste</td><td>' + kacis(V.baslik) + '</td></tr>' +
        '<tr><td>Kaynak Excel</td><td>' + kacis(V.kaynak || '—') + '</td></tr>' +
        '<tr><td>Hazırlandı</td><td>' + tarihYaz(V.olusturma) + '</td></tr>' +
        '<tr><td>Bu cihaza yüklendi</td><td>' + tarihYaz(V.yuklenme) + '</td></tr>' +
        '<tr><td>Haritadaki adres</td><td>' + V.noktalar.length + '</td></tr>' +
        '<tr><td>Kayıt (hane)</td><td>' + kayit + '</td></tr>' +
        '<tr><td>Belgesi olan</td><td>' + pdfli + '</td></tr>' +
        (V.konumsuz.length ? '<tr><td>Konumu bulunamayan</td><td>' + V.konumsuz.length + '</td></tr>' : '') +
        '<tr><td>Depolama</td><td id="depoBilgi">…</td></tr>' +
        '</table>';
      h += '<div class="istHizli">' +
        '<label class="dg vur" for="paketDosya">Yeni paket yükle</label>' +
        '<button class="dg" id="dgSil">Bu cihazdaki verileri sil</button></div>';
      h += '<div class="istNot">Paket ve belgeler yalnızca bu cihazda saklanır, internete gönderilmez. ' +
           'Telefon ve tablet ayrı ayrı yüklenir; "Yapıldı" işaretleri cihazlar arasında paylaşılmaz.</div>';
      h += '<div id="tani"></div>';
      el('paketIc').innerHTML = h;
      el('dgSil').onclick = function(){
        if(!confirm('Paket, belgeler ve "Yapıldı" işaretleri bu cihazdan silinecek. Emin misiniz?')) return;
        try { localStorage.removeItem(V.depoAnahtar); localStorage.removeItem(secimAnahtar()); } catch(e){}
        hepsiniSil().then(function(){ location.reload(); });
      };
      if(navigator.storage && navigator.storage.estimate){
        navigator.storage.estimate().then(function(t){
          var mb = function(x){ return (x / 1048576).toFixed(1) + ' MB'; };
          el('depoBilgi').textContent = mb(t.usage || 0) + (t.quota ? ' / ' + mb(t.quota) : '');
        }).catch(function(){ el('depoBilgi').textContent = '—'; });
      }else el('depoBilgi').textContent = '—';
      taniYaz();
    }

    /* ---- harita zemini ---- */
    function zeminSec(i, sessiz){
      if(i < 0 || i >= ZEMINLER.length) return;
      if(zeminKatman){ harita.removeLayer(zeminKatman); zeminKatman = null; }
      zeminIdx = i;
      var z = ZEMINLER[i];
      var ayar = { attribution: z.atif, maxZoom: z.enFazla || 19 };
      if(z.altAlan) ayar.subdomains = z.altAlan;
      var hata = 0, basari = 0, gecildi = false;
      zeminKatman = L.tileLayer(z.url, ayar);
      zeminKatman.on('tileload', function(){ basari++; });
      zeminKatman.on('tileerror', function(){
        hata++;
        if(!gecildi && basari === 0 && hata >= 4 && navigator.onLine !== false){
          gecildi = true; zeminDenendi[i] = true; otomatikZemin();
        }
      });
      zeminKatman.addTo(harita);
      try { localStorage.setItem('saha_zemin', String(i)); } catch(e){}
      zeminListeCiz();
      if(!sessiz) bildir(z.ad + ' zemini');
    }
    function otomatikZemin(){
      var basarisiz = {};
      Object.keys(zeminDenendi).forEach(function(i){ basarisiz[ZEMINLER[i].sunucu] = true; });
      var aday = -1;
      for(var i = 0; i < ZEMINLER.length; i++){
        if(zeminDenendi[i]) continue;
        if(basarisiz[ZEMINLER[i].sunucu]){ if(aday === -1) aday = i; continue; }
        aday = i; break;
      }
      if(aday === -1){ bildir('Harita zemini yüklenemedi — internet bağlantısını kontrol edin'); return; }
      bildir('Zemin sunucusu yanıt vermedi → ' + ZEMINLER[aday].ad);
      zeminSec(aday, true);
    }
    function zeminListeCiz(){
      var kutu = el('katmanIc'); if(!kutu) return;
      kutu.innerHTML = '';
      ZEMINLER.forEach(function(z, i){
        var c = document.createElement('div');
        c.className = 'cip' + (i === zeminIdx ? ' secili' : '');
        c.textContent = z.ad;
        c.onclick = function(){ zeminDenendi = {}; zeminSec(i); };
        kutu.appendChild(c);
      });
    }

    function taniYaz(){
      var t = el('tani'); if(!t) return;
      var depo = 'kapalı';
      try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); depo = 'çalışıyor'; } catch(e){}
      t.textContent = 'Sürüm ' + UYGULAMA_SURUM +
        ' · Leaflet ' + (typeof L !== 'undefined' ? L.version : 'YOK') +
        ' · PDF ' + (window.pdfjsLib ? pdfjsLib.version : 'YOK') +
        ' · Nokta ' + V.noktalar.length + ' · Yerel depo ' + depo +
        ' · ' + (navigator.onLine === false ? 'çevrimdışı' : 'çevrimiçi');
    }

    /* ---- konum: açıkken mavi nokta hareket eder ---- */
    function konumAc(){
      if(!navigator.geolocation){ bildir('Cihaz konum desteklemiyor'); return; }
      if(izId != null){
        if(benim) harita.setView(benim, Math.max(harita.getZoom(), 16));
        return;
      }
      bildir('Konum alınıyor…');
      var ilk = true;
      izId = navigator.geolocation.watchPosition(function(p){
        benim = [p.coords.latitude, p.coords.longitude];
        if(!konumIsareti){
          konumDaire = L.circle(benim, { radius: p.coords.accuracy || 40, color:'#007AFF', weight:1, fillOpacity:.08 }).addTo(harita);
          konumIsareti = L.circleMarker(benim, { radius:7, fillColor:'#007AFF', color:'#fff', weight:3, fillOpacity:1 }).addTo(harita);
        }else{
          konumIsareti.setLatLng(benim);
          konumDaire.setLatLng(benim); konumDaire.setRadius(p.coords.accuracy || 40);
        }
        if(ilk){ ilk = false; harita.setView(benim, 16); el('dgKonum').classList.add('etkin'); }
        if(el('panelListe').classList.contains('acik')) listeCiz();
      }, function(){
        bildir('Konum alınamadı — konum iznini kontrol edin');
        if(izId != null) navigator.geolocation.clearWatch(izId);
        izId = null;
      }, { enableHighAccuracy:true, timeout:15000, maximumAge:5000 });
    }

    /* ---- kurulum ---- */
    function kur(){
      el('baslik').textContent = V.baslik || 'Saha Haritası';
      document.title = 'Saha · ' + (V.baslik || '');
      el('uygulama').style.display = '';
      if(typeof L === 'undefined'){ uyar('Harita kütüphanesi yüklenemedi', ' Sayfayı yenileyin.'); return; }
      secimYukle();
      harita = L.map('harita', { preferCanvas:true, zoomControl:false, tap:false }).setView([41.0066, 28.7832], 13);
      var kz = 0;
      try { var z = parseInt(localStorage.getItem('saha_zemin'), 10); if(!isNaN(z) && z >= 0 && z < ZEMINLER.length) kz = z; } catch(e){}
      zeminSec(kz, true);

      kumeVar = (typeof L.markerClusterGroup === 'function') && V.noktalar.length > 150;
      katman = kumeVar
        ? L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 17, chunkedLoading: true })
        : L.layerGroup();
      katman.addTo(harita);
      V.noktalar.forEach(function(n){
        var m = L.circleMarker([n.lat, n.lng], stilVer(n));
        m.bindPopup(function(){ return baloncuk(n); }, { maxWidth: 320, autoPanPaddingBottomRight: [20, 70] });
        isaretler[n.id] = m;
        katman.addLayer(m);
      });
      if(V.noktalar.length){
        harita.fitBounds(L.latLngBounds(V.noktalar.map(function(n){ return [n.lat, n.lng]; })), { padding:[40,40] });
      }
      sayacGuncelle(); secimBarGuncelle(); mahalleCiz();

      el('ara').addEventListener('input', function(){
        aramaMetni = norm(this.value.trim());
        filtreUygula();
        if(el('panelListe').classList.contains('acik')) listeCiz();
      });
      el('dgDurum').onclick = function(){
        durumFiltre = durumFiltre === 'tumu' ? 'bekliyor' : (durumFiltre === 'bekliyor' ? 'tamam' : 'tumu');
        this.textContent = durumFiltre === 'tumu' ? 'Tümü' : (durumFiltre === 'bekliyor' ? 'Kalanlar' : 'Yapılanlar');
        this.className = 'dg' + (durumFiltre === 'tumu' ? '' : ' vur');
        filtreIsaretiGuncelle(); filtreUygula();
        if(el('panelListe').classList.contains('acik')) listeCiz();
      };
      el('dgHarita').onclick = kapatPanel;
      el('dgListe').onclick = function(){ if(panelAc('panelListe', 'dgListe')){ listeCiz(); secimBarGuncelle(); } };
      el('dgIst').onclick = function(){ if(panelAc('panelIst', 'dgIst')) istatistikCiz(); };
      el('dgPaket').onclick = function(){ if(panelAc('panelPaket', 'dgPaket')) paketCiz(); };
      el('dgMahalle').onclick = function(){ panelAc('panelMahalle', 'dgMahalle'); };
      el('dgKatman').onclick = function(){ if(panelAc('panelKatman', null)) zeminListeCiz(); };
      el('secKml').onclick = kmlVer;
      el('secTumu').onclick = function(){
        var liste = V.noktalar.filter(gecerli);
        var hepsi = liste.length > 0 && liste.every(function(n){ return !!secili[n.id]; });
        secimTopluAyarla(liste, !hepsi);
        bildir(hepsi ? 'Listedeki seçimler bırakıldı' : (liste.length + ' adres seçildi'));
      };
      el('secTemizle').onclick = function(){ secimTopluAyarla(seciliListe(), false); };
      el('dgKonum').onclick = konumAc;
      el('dgSifirla').onclick = function(){
        if(confirm('Tüm "Yapıldı" işaretleri silinecek. Emin misiniz?')){
          try { localStorage.removeItem(V.depoAnahtar); } catch(e){}
          location.reload();
        }
      };

      window.__saha = { harita:harita, veri:V, isaretler:isaretler, pdfAc:pdfAc, noktayaGit:noktayaGit,
                        gecerliListe:function(){ return V.noktalar.filter(gecerli); } };

      function boyut(){
        document.body.classList.toggle('genis', window.innerWidth >= 900);
        harita.invalidateSize();
      }
      boyut();
      setTimeout(function(){ harita.invalidateSize(); }, 200);
      window.addEventListener('resize', boyut);
      window.addEventListener('orientationchange', function(){ setTimeout(boyut, 300); });
    }
    kur();
  }

  /* ------------------------------------------------------------------
     Başlangıç
     ------------------------------------------------------------------ */
  if('serviceWorker' in navigator && location.protocol === 'https:'){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
  dbAc().then(function(d){
    db = d;
    return dbAl('meta', 'paket');
  }).then(function(V){
    if(V && V.noktalar) sahaBaslat(V);
    else karsilamaGoster();
  }).catch(function(e){
    karsilamaGoster();
    uyar('Yerel depolama açılamadı', ' ' + (e && e.message ? e.message : e) + ' — gizli sekmede olabilirsiniz.');
  });
}());
