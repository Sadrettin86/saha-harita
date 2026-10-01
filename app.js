/* =========================================================================
   Saha Haritası — telefon / tablet görüntüleyicisi
   PC'deki "Küçükçekmece Adres Haritası" aracının ürettiği telefon paketini
   (harita noktaları + hane PDF'leri) açar. Paket bu cihazın içinde saklanır;
   hiçbir veri sunucuya gönderilmez.
   ========================================================================= */
(function(){
  'use strict';

  var UYGULAMA_SURUM = '2.2.0';
  /* Gömülü kip: PC aracının ürettiği saha haritası dosyası (genelde file:// ile açılır).
     Veri dosyanın içinde gelir; belgeler bilgisayardaki bir klasörden okunur. */
  var GOMULU = window.__SAHA_VERI__ || null;
  var DOSYADAN = location.protocol === 'file:';
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
  /* ---- Simgeler: tek renkli çizgi simgeler (24'lük ızgara) ---- */
  var IKON = {
    ara:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    katman:'<path d="M12 2.8 2.5 7.6l9.5 4.8 9.5-4.8z"/><path d="m2.5 12 9.5 4.8 9.5-4.8"/><path d="m2.5 16.4 9.5 4.8 9.5-4.8"/>',
    harita:'<path d="M9 3.5 3 6v14.5l6-2.5 6 2.5 6-2.5V3.5L15 6z"/><path d="M9 3.5V18M15 6v14.5"/>',
    liste:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
    filtre:'<path d="M3.5 5h17l-6.5 8v5.5l-4 2V13z"/>',
    ozet:'<path d="M5 20v-7M11 20V5M17 20v-10M3 20h18"/>',
    paket:'<path d="M3.5 4.5h17v4h-17z"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>',
    konum:'<path d="M20.5 3.5 3.5 10.8l7.4 2.3 2.3 7.4z"/>',
    yon:'<path d="M12 3 19 20.5 12 16.5 5 20.5z"/>',
    belge:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    telefon:'<path d="M6.6 3.5h2.9l1.6 4.2-2.1 1.4a11 11 0 0 0 5.9 5.9l1.4-2.1 4.2 1.6v2.9a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.4 5.7a2 2 0 0 1 2.2-2.2z"/>',
    daire:'<circle cx="12" cy="12" r="8.5"/>',
    onay:'<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.6 2.6 5-5.3"/>',
    yildiz:'<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    tarif:'<path d="M11.3 2.9a1 1 0 0 1 1.4 0l8.4 8.4a1 1 0 0 1 0 1.4l-8.4 8.4a1 1 0 0 1-1.4 0l-8.4-8.4a1 1 0 0 1 0-1.4z"/><path d="M9.3 15v-3a1 1 0 0 1 1-1h4.5M13 8.8l2.2 2.2-2.2 2.2"/>',
    goz:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    disLink:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    uyari:'<path d="M12 4.2 2.8 19.8h18.4z"/><path d="M12 10v4.5M12 17.2v.01"/>',
    arti:'<path d="M12 5v14M5 12h14"/>', eksi:'<path d="M5 12h14"/>',
    tik:'<path d="m5 12.5 4.5 4.5L19 7"/>',
    pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
  };
  function ik(ad, sinif){
    return '<svg class="ik' + (sinif ? ' ' + sinif : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (IKON[ad] || '') + '</svg>';
  }
  document.querySelectorAll('[data-ik]').forEach(function(e){ e.outerHTML = ik(e.getAttribute('data-ik')); });
  var PUSULA_SVG = '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M15 4.5 18.2 15h-6.4z" fill="#FF3B30"/>' +
                   '<path d="M15 25.5 11.8 15h6.4z" fill="#8E8E93"/></svg>';

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
        throw new Error('Bu dosya bir telefon paketi değil. PC aracında Dışa aktar > Telefon paketi ile hazırlayın.');
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
        ? 'Safari\'de <b>Paylaş</b> menüsünden <b>Ana Ekrana Ekle</b> ile uygulama gibi açabilirsiniz.'
        : 'Chrome menüsünden <b>Uygulamayı yükle</b> ile uygulama gibi açabilirsiniz.';
    }
  }

  /* ------------------------------------------------------------------
     PDF görüntüleyici
     ------------------------------------------------------------------ */
  if(window.pdfjsLib){
    /* Gömülü kipte worker <script> ile yüklenir (window.pdfjsWorker) ve ana iş parçacığında çalışır */
    if(!GOMULU) pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
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

  el('pdfKapat').onclick = pdfKapat;
  el('pdfArti').onclick = function(){ pdfZoom(pdf.zoom + 0.5); };
  el('pdfEksi').onclick = function(){ pdfZoom(pdf.zoom - 0.5); };
  pdfDokunmaKur();

  function dbYaz(depo, anahtar, deger){
    return new Promise(function(ok, red){
      var t = db.transaction(depo, 'readwrite');
      t.objectStore(depo).put(deger, anahtar);
      t.oncomplete = function(){ ok(); };
      t.onerror = function(){ red(t.error); };
    });
  }
  function haneTemiz(v){ return String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, ''); }
  function trNorm(s){
    return String(s == null ? '' : s).replace(/[İIı]/g,'i').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function karma(s){
    var h = 5381;
    for(var i = 0; i < s.length; i++){ h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; }
    return h.toString(36);
  }
  /* PDF metninden "Hane No" (PC aracındakiyle aynı kural) */
  function haneNoMetindenBul(ogeler){
    var o = ogeler.map(function(i){
      return { s:String(i.str || ''), x:i.transform ? i.transform[4] : 0, y:i.transform ? i.transform[5] : 0 };
    }).filter(function(i){ return i.s.trim(); });
    for(var i = 0; i < o.length; i++){
      if(!/^hane no( |$)/.test(trNorm(o[i].s))) continue;
      var ayni = trNorm(o[i].s).match(/^hane no (\d{4,12})\b/);
      if(ayni) return haneTemiz(ayni[1]);
      var e = o[i], enIyi = null;
      o.forEach(function(c){
        var t = c.s.trim();
        if(!/^\d{4,12}$/.test(t) || Math.abs(c.y - e.y) > 3 || c.x <= e.x) return;
        if(!enIyi || c.x < enIyi.x) enIyi = c;
      });
      if(enIyi) return haneTemiz(enIyi.s);
      for(var j = i + 1; j < Math.min(o.length, i + 5); j++){
        var t2 = o[j].s.trim();
        if(/^[:.\s]*$/.test(t2)) continue;
        if(/^:?\s*\d{4,12}$/.test(t2)) return haneTemiz(t2);
        break;
      }
    }
    var m = trNorm(o.map(function(i){ return i.s; }).join(' ')).match(/\bhane no (\d{4,12})\b/);
    return m ? haneTemiz(m[1]) : '';
  }
  function pdfHaneNo(dosya){
    return dosya.arrayBuffer().then(function(buf){
      return pdfjsLib.getDocument({ data:new Uint8Array(buf), isEvalSupported:false }).promise;
    }).then(function(doc){
      var sayfa = Math.min(doc.numPages, 2), p = 1;
      function sonraki(){
        if(p > sayfa){ doc.destroy(); return ''; }
        return doc.getPage(p++).then(function(pg){ return pg.getTextContent(); }).then(function(tc){
          var h = haneNoMetindenBul(tc.items);
          if(h){ doc.destroy(); return h; }
          return sonraki();
        });
      }
      return sonraki();
    }).catch(function(){ return ''; });
  }

  /* iOS tarzı seçenek sayfası. Seçilen değeri ya da vazgeçilirse null döner */
  function secimIste(baslik, secenekler){
    return new Promise(function(cozum){
      var perde = document.createElement('div');
      perde.className = 'eylemPerde';
      var h = '<div class="eylemKutu"><div class="eylemGrup"><div class="eylemBaslik">' + kacis(baslik) + '</div>';
      secenekler.forEach(function(o, i){
        h += '<button data-i="' + i + '"' + (o.pasif ? ' disabled' : '') + '><span>' + kacis(o.ad) + '</span>' +
             (o.not ? '<small>' + kacis(o.not) + '</small>' : '') + '</button>';
      });
      h += '</div><div class="eylemGrup"><button class="vazgec">Vazgeç</button></div></div>';
      perde.innerHTML = h;
      function kapat(d){ perde.remove(); cozum(d); }
      perde.addEventListener('click', function(e){
        var b = e.target.closest('button');
        if(!b){ if(e.target === perde) kapat(null); return; }
        if(b.classList.contains('vazgec')) kapat(null);
        else kapat(secenekler[+b.getAttribute('data-i')].deger);
      });
      document.body.appendChild(perde);
    });
  }
  function indirBlob(blob, ad){
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = ad; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ a.remove(); URL.revokeObjectURL(u); }, 3000);
  }
  function dosyaBase64(f){
    return new Promise(function(ok, red){
      var fr = new FileReader();
      fr.onload = function(){ ok(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function(){ red(fr.error); };
      fr.readAsDataURL(f);
    });
  }

  /* Belgenin içeriği: telefonda pakette (IndexedDB), gömülü kipte seçilen klasörde */
  var belgeDosya = {};          /* hane no -> File (gömülü kip) */
  var belgeTarandi = false;
  function pdfVeriAl(k){
    if(GOMULU){
      var f = belgeDosya[haneTemiz(k.haneNo)];
      return f ? f.arrayBuffer() : Promise.resolve(null);
    }
    return dbAl('pdf', k.pdf);
  }

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
      { ad:'OpenStreetMap', sunucu:'osm',
        url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        atif:'© OpenStreetMap katkıcıları', enFazla:19, dosyadaYok:true },
      { ad:'Sokak', sunucu:'esri',
        url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        atif:'Esri · HERE · Garmin · © OpenStreetMap katkıcıları', enFazla:19 },
      { ad:'Uydu', sunucu:'esri',
        url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        atif:'Esri · Maxar · Earthstar Geographics', enFazla:19 },
      { ad:'Sade', sunucu:'carto',
        url:'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        atif:'© OpenStreetMap katkıcıları · © CARTO', enFazla:20, altAlan:'abcd' }
    ];
    var zeminKatman = null, zeminIdx = 0, zeminDenendi = {};
    var durumFiltre = 'tumu';
    var belgeFiltre = 'tumu';   /* tumu | var | yok — seçim cihazda hatırlanır */
    try { var bf = localStorage.getItem('saha_belge_filtre'); if(bf === 'var' || bf === 'yok') belgeFiltre = bf; } catch(e){}
    if(GOMULU) belgeFiltre = 'tumu';   /* belgeler her açılışta yeniden okunur */
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
      if(s) s.textContent = n ? (n + ' adres seçili') : 'Seçim yok · KML görünenleri alır';
      var t = el('secTemizle');
      if(t) t.disabled = n === 0;
    }

    /* ---- sayaçlar ---- */
    function sayacGuncelle(){
      var d = durumlar(), toplam = 0, yapildi = 0;
      V.noktalar.forEach(function(n){
        n.kayitlar.forEach(function(k){ toplam++; if(d[k.id] === 'tamam') yapildi++; });
      });
      el('sToplam').textContent = toplam;
      el('sYapildi').textContent = yapildi;
      el('ilerlemeDolgu').style.width = (toplam ? Math.round(yapildi / toplam * 100) : 0) + '%';
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
        '<div class="istK"><b style="color:var(--yesil)">' + s.kayitYapildi + '</b><span>Yapıldı</span></div>' +
        '<div class="istK"><b>' + (s.kayit - s.kayitYapildi) + '</b><span>Kalan</span></div>' +
        '<div class="istK"><b>' + s.kayit + '</b><span>Toplam hane</span></div></div>';
      h += '<div class="istBas">Mahalleye göre</div>';
      h += '<table class="istT"><thead><tr><th>Mahalle</th><th>Yapıldı</th><th>Kalan</th></tr></thead><tbody>';
      s.mahalleAdlari.forEach(function(m){
        var v = s.mahalle[m];
        h += '<tr><td><i class="nok" style="background:' + (V.mahalleRenk[m] || '#007AFF') + '"></i>' + kacis(m) + '</td>' +
             '<td>' + v.tamam + '</td><td>' + v.kalan + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="istBas">Ziyaret durumu ve KML seçimi</div>';
      h += '<table class="istT"><thead><tr><th>Adres</th><th>Toplam</th><th>Seçimde</th></tr></thead><tbody>';
      [['Yapıldı','tamam','#34C759'],['Kısmen yapıldı','kismi','#FF9500'],['Yapılmadı','bekliyor','#FF3B30']].forEach(function(r){
        h += '<tr><td><i class="nok" style="background:' + r[2] + '"></i>' + r[0] + '</td><td>' + s.durum[r[1]] + '</td>' +
             '<td>' + s.secDurum[r[1]] + '</td></tr>';
      });
      h += '<tr class="top"><td>Toplam</td><td>' + s.adres + '</td><td>' + s.secAdres + '</td></tr>';
      if(s.supheli){
        h += '<tr><td>Şüpheli konum</td><td>' + s.supheli + '</td><td>' + s.secSupheli + '</td></tr>';
      }
      h += '</tbody></table>';
      h += '<div class="istBas">Hızlı seçim</div>';
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
      if(!liste.length){ bildir('Bu ölçüte uyan adres yok'); return; }
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

    /* ---- baloncuk (hane kartı) ---- */
    function baloncuk(n){
      var dur = noktaDurumu(n);
      var h = '<div class="b">';
      h += '<div class="bBaslik">' + kacis(etiketMetni(n)) + '</div>';
      h += '<div class="bAlt">' + kacis(n.mahalle) + '</div>';
      if(n.snf === 'supheli') h += '<div class="bUyari">' + ik('uyari', 'k') + 'Konum yaklaşık, sokakta teyit edin</div>';
      n.kayitlar.forEach(function(k){
        var kd = kayitDurumu(k.id);
        var meta = [];
        if(k.haneNo) meta.push('Hane ' + k.haneNo);
        if(k.daire) meta.push('İç kapı ' + k.daire);
        if(k.kisi) meta.push(k.kisi + ' kişi');
        if(k.yardim) meta.push(k.yardim);
        if(k.tarih) meta.push(k.tarih);
        h += '<div class="bKayit">';
        h += '<div class="bAd">' + kacis(k.ad || ('Hane ' + (k.haneNo || ''))) + '</div>';
        if(meta.length) h += '<div class="bMeta">' + kacis(meta.join(' · ')) + '</div>';
        h += '<div class="bEylem">';
        h += k.pdf ? '<button class="btn btnMavi" data-pdf="' + kacis(k.id) + '">' + ik('belge', 'k') + 'Belge</button>'
                   : '<span class="btn btnPasif">' + (GOMULU && !belgeTarandi ? 'Belge bakılmadı' : 'Belge yok') + '</span>';
        if(k.telNs) h += '<a class="btn btnYesil" href="' + kacis(k.telNs) + '">' + ik('telefon', 'k') + 'NetSipp ile ara</a>';
        h += '</div>';
        h += '<button class="bYapildi ' + kd + '" data-kayit="' + kacis(k.id) + '" data-nokta="' + n.id + '">' +
             (kd === 'tamam' ? ik('onay', 'k') + 'Yapıldı' : ik('daire', 'k') + 'Yapıldı olarak işaretle') + '</button>';
        h += '</div>';
      });
      if(n.kayitlar.length > 1){
        h += '<button class="bHepsi" data-hepsi="' + n.id + '">' +
             (dur === 'tamam' ? 'Tümünün işaretini kaldır' : 'Tümünü yapıldı işaretle') + '</button>';
      }
      h += '<div class="bLinkler">' +
           '<a class="bLink" href="https://www.google.com/maps/dir/?api=1&destination=' + n.lat + ',' + n.lng + '" target="_blank" rel="noopener">' + ik('tarif') + 'Yol tarifi</a>' +
           '<a class="bLink" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + n.lat + ',' + n.lng + '" target="_blank" rel="noopener">' + ik('goz') + 'Sokak görünümü</a>' +
           '<a class="bLink" href="https://yandex.com.tr/harita/?rtext=~' + n.lat + ',' + n.lng + '&rtt=auto" target="_blank" rel="noopener">' + ik('disLink') + 'Yandex</a>' +
           '</div>';
      h += '<button class="bSec' + (secili[n.id] ? ' secik' : '') + '" data-sec="' + n.id + '">' +
           ik('yildiz', 'kk' + (secili[n.id] ? ' dolu' : '')) + (secili[n.id] ? 'KML seçiminde' : 'KML seçimine ekle') + '</button>';
      return h + '</div>';
    }

    /* ---- PDF paneli ---- */
    function pdfEylemCiz(){
      var k = pdf.kayit; if(!k) return;
      var kd = kayitDurumu(k.id);
      var h = '';
      if(k.telNs) h += '<a class="dg vurY" href="' + kacis(k.telNs) + '">' + ik('telefon', 'kk') + 'NetSipp ile ara</a>';
      h += '<button class="dg' + (kd === 'tamam' ? ' vurY' : '') + '" data-kayit="' + kacis(k.id) + '"' +
           (kayitHarita[k.id] && kayitHarita[k.id].n ? ' data-nokta="' + kayitHarita[k.id].n.id + '"' : '') + '>' +
           (kd === 'tamam' ? ik('tik', 'kk') + 'Yapıldı' : 'Yapıldı olarak işaretle') + '</button>';
      var r = kayitHarita[k.id];
      if(r && r.n && document.body.classList.contains('genis') === false){
        h += '<button class="dg" id="pdfHaritada">' + ik('pin', 'kk') + 'Haritada göster</button>';
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
      pdfVeriAl(k).then(function(buf){
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
    /* Bir adreste birden çok hane olabilir: "olan" = en az birinin belgesi var,
       "olmayan" = en az birinin belgesi yok */
    function belgeUyar(kayitlar){
      if(belgeFiltre === 'var') return kayitlar.some(function(k){ return !!k.pdf; });
      if(belgeFiltre === 'yok') return kayitlar.some(function(k){ return !k.pdf; });
      return true;
    }
    function gecerli(n){
      if(mahalleKapali[n.mahalle]) return false;
      if(!belgeUyar(n.kayitlar)) return false;
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
      harita.setView([n.lat, n.lng], 18, { animate:false });
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
            (pdfVar ? '<span class="pdfIkon" title="Belge">' + ik('belge', 'k') + '</span>' : '') +
            '<span class="sc">' + ik('yildiz', 'k' + (secili[n.id] ? ' dolu' : '')) + '</span>';
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
          u.className = 'bosluk'; u.textContent = (liste.length - 400) + ' adres daha var, arama ile daraltın';
          kutu.appendChild(u);
        }
      }
      /* Konumu bulunamayan kayıtlar — haritada yok, belgeleri açılabilir */
      var ks = V.konumsuz.filter(function(k){
        return belgeUyar([k]) && (!aramaMetni || norm(aramaMetniKayit(k)).indexOf(aramaMetni) !== -1);
      });
      if(ks.length){
        var bas = document.createElement('div'); bas.className = 'istBas';
        bas.textContent = 'Konumu bulunamayan (' + ks.length + ')';
        kutu.appendChild(bas);
        var sar2 = document.createElement('div'); sar2.className = 'listeKutu';
        kutu.appendChild(sar2);
        ks.forEach(function(k){
          var kd = kayitDurumu(k.id);
          var s = document.createElement('div'); s.className = 'satir';
          s.innerHTML = '<span class="no" style="background:' + noktaRengi(kd) + '"></span>' +
            '<span class="bl"><span class="a1">' + kacis(k.ad || ('Hane ' + k.haneNo)) + '</span>' +
            '<span class="a2">' + kacis(k.adres || '') + (k.tel ? ' · ' + kacis(k.tel) : '') + '</span></span>' +
            (k.pdf ? '<span class="pdfIkon">' + ik('belge', 'k') + '</span>' : '');
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
      bildir(liste.length + ' ' + kaynak + ' adres KML olarak hazır');
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
      var aktif = durumFiltre !== 'tumu' || belgeFiltre !== 'tumu' || Object.keys(mahalleKapali).some(function(m){ return mahalleKapali[m]; });
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
      function satir(ad, deger, id){
        return '<div class="satir"><span class="bl"><span class="a1">' + ad + '</span></span>' +
               '<span class="deger"' + (id ? ' id="' + id + '"' : '') + '>' + deger + '</span></div>';
      }
      var h = '<div class="grupBas">Liste</div><div class="grup">' +
        satir('Ad', kacis(V.baslik)) +
        satir('Kaynak Excel', kacis(V.kaynak || '—')) +
        satir('Hazırlandı', tarihYaz(V.olusturma)) +
        satir('Bu cihaza yüklendi', tarihYaz(V.yuklenme)) + '</div>';
      h += '<div class="grupBas">İçerik</div><div class="grup">' +
        satir('Haritadaki adres', V.noktalar.length) +
        satir('Hane', kayit) +
        satir('Belgesi olan', pdfli) +
        (V.konumsuz.length ? satir('Konumu bulunamayan', V.konumsuz.length) : '') +
        satir('Kullanılan alan', '…', 'depoBilgi') + '</div>';
      h += '<div class="grupBas"></div><div class="grup">' +
        '<label class="satir eylem" for="paketDosya">Yeni paket yükle</label>' +
        '<button class="satir eylem tehlike" id="dgSil">Bu cihazdaki verileri sil</button></div>';
      h += '<div class="grupNot">Paket ve belgeler yalnızca bu cihazda saklanır, internete gönderilmez. ' +
           'Telefon ve tablete ayrı ayrı yüklenir; Yapıldı işaretleri cihazlar arasında paylaşılmaz.</div>';
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
          el('depoBilgi').textContent = mb(t.usage || 0);
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
      try { localStorage.setItem(DOSYADAN ? 'saha_zemin_dosya' : 'saha_zemin_v2', String(i)); } catch(e){}
      zeminListeCiz();
      if(!sessiz) bildir(z.dosyadaYok && DOSYADAN ? 'OpenStreetMap bilgisayardan açılan dosyada harita vermez'
                                                  : z.ad + ' zemini');
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
      if(aday === -1){ bildir('Harita zemini yüklenemedi, internet bağlantısını kontrol edin'); return; }
      bildir('Zemin sunucusu yanıt vermedi, ' + ZEMINLER[aday].ad + ' kullanılıyor');
      zeminSec(aday, true);
    }
    function zeminListeCiz(){
      var kutu = el('katmanIc'); if(!kutu) return;
      kutu.innerHTML = '';
      ZEMINLER.forEach(function(z, i){
        var c = document.createElement('button');
        c.className = 'satir';
        c.innerHTML = '<span class="bl"><span class="a1">' + kacis(z.ad) + '</span>' +
                      (z.dosyadaYok && DOSYADAN ? '<span class="a2">Bilgisayardan açılan dosyada çalışmaz</span>' : '') + '</span>' +
                      (i === zeminIdx ? '<span class="tik">' + ik('tik', 'k') + '</span>' : '');
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

    /* ---- konum: uygulama açılınca başlar, mavi nokta anlık hareket eder ----
       Konum düğmesi haritayı konuma getirir ve "takip" açar (yürüdükçe harita da kayar);
       haritayı elle kaydırınca takip kapanır, nokta görünmeye devam eder. */
    var takip = false, sonListeKonum = null, izinYok = false;
    function konumCiz(p){
      benim = [p.coords.latitude, p.coords.longitude];
      var dogruluk = Math.min(p.coords.accuracy || 40, 500);
      if(!konumIsareti){
        harita.createPane('konumPane');
        harita.getPane('konumPane').style.zIndex = 640;
        konumDaire = L.circle(benim, { radius: dogruluk, color:'#007AFF', weight:1, fillOpacity:.10,
                                       interactive:false, pane:'konumPane', renderer: L.svg({ pane:'konumPane' }) }).addTo(harita);
        konumIsareti = L.marker(benim, { pane:'konumPane', interactive:false, keyboard:false,
          icon: L.divIcon({ className:'konumNokta', html:'<span></span>', iconSize:[22,22], iconAnchor:[11,11] }) }).addTo(harita);
      }else{
        konumIsareti.setLatLng(benim);
        konumDaire.setLatLng(benim); konumDaire.setRadius(dogruluk);
      }
      if(yonModu && !yonDinleyici && p.coords.heading != null && !isNaN(p.coords.heading) && (p.coords.speed || 0) > 0.7){
        gpsYon = p.coords.heading; yonUygula(gpsYon);
      }
      if(takip) harita.panTo(benim, { animate:true });
      if(el('panelListe').classList.contains('acik') &&
         (!sonListeKonum || uzaklik(sonListeKonum, benim) > 0.03)){
        sonListeKonum = benim; listeCiz();
      }
    }
    function konumIzle(){
      if(!navigator.geolocation || izId != null || izinYok) return;
      izId = navigator.geolocation.watchPosition(konumCiz, function(h){
        if(h && h.code === 1){            /* izin verilmedi */
          izinYok = true;
          if(izId != null) navigator.geolocation.clearWatch(izId);
          izId = null; takip = false; konumIkonu();
          bildir('Konum izni yok — telefon ayarlarından konuma izin verin');
        }
        /* zaman aşımı / geçici hata: izleme sürer */
      }, { enableHighAccuracy:true, timeout:20000, maximumAge:3000 });
    }
    function konumDurdur(){
      if(izId != null){ navigator.geolocation.clearWatch(izId); izId = null; }
    }
    function konumIkonu(){
      var b = el('dgKonum');
      b.innerHTML = yonModu ? ik('yon', 'dolu') : ik('konum', takip ? 'dolu' : '');
    }
    function konumDugmesi(){
      if(!navigator.geolocation){ bildir('Cihaz konum desteklemiyor'); return; }
      if(izinYok){ izinYok = false; }
      konumIzle();
      /* 1. dokunuş: konuma git + takip · 2. dokunuş: yön modu · 3. dokunuş: kuzey yukarı */
      if(takip && benim && !yonModu){ yonModuAc(); return; }
      if(yonModu){ yonModuKapat(true); takip = true; konumIkonu(); return; }
      takip = true;
      konumIkonu();
      if(benim) harita.setView(benim, Math.max(harita.getZoom(), 17));
      else{
        bildir('Konum alınıyor…');
        navigator.geolocation.getCurrentPosition(function(p){
          konumCiz(p); harita.setView(benim, Math.max(harita.getZoom(), 17));
        }, function(){}, { enableHighAccuracy:true, timeout:15000 });
      }
    }

    /* ---- nokta etiketi: SOKAK dış kapı/iç kapı (aynı binada birden çok daire varsa virgülle) ---- */
    function etiketHtml(n){
      var belgeli = n.kayitlar.some(function(k){ return !!k.pdf; });
      return (belgeli ? ik('belge', 'etiketIk') : '') + kacis(etiketMetni(n));
    }
    function etiketMetni(n){
      var daireler = [];
      n.kayitlar.forEach(function(k){
        var d = String(k.daire || '').trim();
        if(d && daireler.indexOf(d) === -1) daireler.push(d);
      });
      var dis = String(n.kapi || '').trim();
      var no = dis + (daireler.length ? '/' + daireler.join(',') : '');
      return ((n.cadde || '') + ' ' + no).replace(/\s+/g, ' ').trim() || n.pinAd || '';
    }
    /* Etiketler uzaktan bakınca kalabalık yapmasın: yakınlaşınca görünür */
    var ETIKET_ZOOM = 16;
    function etiketGorunurluk(){
      el('harita').classList.toggle('etiketGizli', harita.getZoom() < ETIKET_ZOOM);
    }

    /* ---- yön: harita gidilen yöne döner ----
       Pusula (telefonun manyetik sensörü) varsa o kullanılır — dururken de çalışır;
       yoksa GPS'in hareket yönü. leaflet-rotate'te bearing = -yön. */
    var yonModu = false, yonDinleyici = null, sonYon = null, gpsYon = null, yonZaman = 0;
    function ekranAcisi(){
      var a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle
            : (typeof window.orientation === 'number' ? window.orientation : 0);
      return a || 0;
    }
    function yonUygula(yon){
      if(!yonModu || yon == null || isNaN(yon)) return;
      yon = (yon + 360) % 360;
      if(sonYon != null){
        var fark = ((yon - sonYon + 540) % 360) - 180;
        if(Math.abs(fark) < 3) return;          /* küçük titremeleri at */
        yon = (sonYon + fark * 0.5 + 360) % 360; /* yumuşat */
      }
      var simdi = Date.now();
      if(simdi - yonZaman < 120) return;          /* saniyede ~8 güncelleme */
      yonZaman = simdi; sonYon = yon;
      harita.setBearing(-yon);
      if(takip && benim) harita.panTo(benim, { animate:false });
    }
    function pusulaOlayi(e){
      var yon = null;
      if(typeof e.webkitCompassHeading === 'number') yon = e.webkitCompassHeading + ekranAcisi();       /* iOS */
      else if(e.absolute && typeof e.alpha === 'number') yon = 360 - e.alpha + ekranAcisi();           /* Android */
      if(yon != null) yonUygula(yon);
    }
    function pusulaBaslat(){
      if(yonDinleyici) return Promise.resolve(true);
      var baslat = function(){
        yonDinleyici = pusulaOlayi;
        if('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', yonDinleyici);
        else window.addEventListener('deviceorientation', yonDinleyici);
        return true;
      };
      if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function'){
        return DeviceOrientationEvent.requestPermission()               /* iOS: dokunuşla izin ister */
          .then(function(d){ return d === 'granted' ? baslat() : false; })
          .catch(function(){ return false; });
      }
      return Promise.resolve(window.DeviceOrientationEvent ? baslat() : false);
    }
    function pusulaDurdur(){
      if(!yonDinleyici) return;
      window.removeEventListener('deviceorientationabsolute', yonDinleyici);
      window.removeEventListener('deviceorientation', yonDinleyici);
      yonDinleyici = null;
    }
    function yonModuAc(){
      yonModu = true; sonYon = null;
      el('dgKonum').classList.add('etkin', 'yon');
      konumIkonu();
      pusulaBaslat().then(function(ok){
        if(!ok) bildir('Pusula kullanılamıyor — yürürken GPS yönü kullanılacak');
        else bildir('Harita gittiğiniz yöne dönüyor');
      });
    }
    function yonModuKapat(kuzeyeDon){
      yonModu = false; sonYon = null;
      pusulaDurdur();
      el('dgKonum').classList.remove('yon');
      konumIkonu();
      if(kuzeyeDon) harita.setBearing(0);
    }
    function pusulaGuncelle(){
      var b = harita.getBearing ? harita.getBearing() : 0;
      var egik = Math.abs(((b + 540) % 360) - 180) > 1;
      el('dgPusula').style.display = egik ? 'flex' : 'none';
      var sv = el('dgPusula').firstChild;
      if(sv) sv.style.transform = 'rotate(' + b + 'deg)';
    }

    /* ==================================================================
       Gömülü kip: belge klasörü ve telefon paketi
       ================================================================== */
    var belgeDurum = { klasor:'', zaman:null, tarama:'', okunan:0, toplamPdf:0 };
    function tumKayitlar(){
      var l = [];
      V.noktalar.forEach(function(n){ n.kayitlar.forEach(function(k){ l.push(k); }); });
      return l.concat(V.konumsuz);
    }
    function belgeSayilari(){
      var t = tumKayitlar();
      return { hane:t.length, belgeli:t.filter(function(k){ return !!k.pdf; }).length };
    }
    function belgePanelCiz(){
      if(!el('panelPaket').classList.contains('acik')) return;
      var say = belgeSayilari();
      function satir(ad, deger){
        return '<div class="satir"><span class="bl"><span class="a1">' + ad + '</span></span>' +
               '<span class="deger">' + deger + '</span></div>';
      }
      var h = '<div class="grupBas">Belge klasörü</div><div class="grup">' +
        satir('Klasör', kacis(belgeDurum.klasor || 'seçilmedi')) +
        satir('Belgesi bulunan', belgeTarandi ? (say.belgeli + ' / ' + say.hane + ' hane') : '—') +
        satir('Son kontrol', belgeDurum.zaman ? belgeDurum.zaman.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' }) : '—') +
        (belgeDurum.tarama ? satir('Durum', kacis(belgeDurum.tarama)) : '') + '</div>';
      h += '<div class="grupBas"></div><div class="grup">' +
        '<button class="satir eylem" id="dgBelgeKontrol">' + (belgeDurum.klasor ? 'Belgeleri yeniden kontrol et' : 'Klasör seç ve belgeleri kontrol et') + '</button>' +
        (belgeDurum.klasor ? '<button class="satir eylem" id="dgBelgeKlasor">Başka klasör seç</button>' : '') + '</div>';
      h += '<div class="grupNot">Genelde İndirilenler klasörü. Tarayıcı, güvenlik gereği klasörü ilk seferde sizin seçmenizi ister; ' +
           'Chrome ve Edge sonraki açılışlarda hatırlar. Okunan PDF\'ler hatırlanır, sonraki kontrollerde yalnızca yeni gelenler okunur. ' +
           'Aynı haneye ait birden çok PDF varsa en yeni indirilen kullanılır.</div>';
      h += '<div class="grupBas">Telefon</div><div class="grup">' +
        '<button class="satir eylem" id="dgTelPaket">Telefon paketi oluştur</button></div>' +
        '<div class="grupNot">Saha uygulamasında açılan dosya. Belgeler pakete eklenir.</div>';
      el('paketIc').innerHTML = h;
      el('dgBelgeKontrol').onclick = function(){ belgeleriKontrol(false); };
      if(el('dgBelgeKlasor')) el('dgBelgeKlasor').onclick = function(){ belgeleriKontrol(true); };
      el('dgTelPaket').onclick = telefonPaketi;
    }

    /* Klasördeki PDF dosyalarını al: Chrome/Edge'de klasör hatırlanır, diğerlerinde her seferinde seçilir */
    function klasordenDosyalar(yeniKlasor){
      if(window.showDirectoryPicker && db){
        var tutamac = null;
        return (yeniKlasor ? Promise.resolve(null) : dbAl('meta', 'belgeKlasoru').catch(function(){ return null; }))
          .then(function(h){
            if(!h) return null;
            return h.queryPermission({ mode:'read' }).then(function(iz){
              return iz === 'granted' ? iz : h.requestPermission({ mode:'read' });
            }).then(function(iz){ return iz === 'granted' ? h : null; }).catch(function(){ return null; });
          }).then(function(h){
            if(h) return h;
            return window.showDirectoryPicker({ id:'saha-belgeler', startIn:'downloads', mode:'read' }).then(function(y){
              return dbYaz('meta', 'belgeKlasoru', y).catch(function(){}).then(function(){ return y; });
            });
          }).then(function(h){
            tutamac = h;
            var dosyalar = [], it = h.values();
            function adim(){
              return it.next().then(function(r){
                if(r.done) return dosyalar;
                var g = r.value;
                if(g.kind === 'file' && /\.pdf$/i.test(g.name)){
                  return g.getFile().then(function(f){ dosyalar.push(f); return adim(); });
                }
                return adim();
              });
            }
            return adim();
          }).then(function(d){ return { ad: tutamac.name, dosyalar: d }; });
      }
      /* Yedek: klasör seçme penceresi (hatırlanmaz) */
      return new Promise(function(ok, red){
        var inp = document.createElement('input');
        inp.type = 'file'; inp.multiple = true; inp.setAttribute('webkitdirectory', '');
        inp.onchange = function(){
          var d = Array.prototype.filter.call(inp.files || [], function(f){ return /\.pdf$/i.test(f.name); });
          var ilk = inp.files && inp.files[0];
          ok({ ad: ilk && ilk.webkitRelativePath ? ilk.webkitRelativePath.split('/')[0] : 'seçilen klasör', dosyalar: d });
        };
        inp.click();
      });
    }

    var ONBELLEK = 'saha_pdf_hane_v1';
    function belgeleriTara(sonuc){
      var onb = {};
      try { onb = JSON.parse(localStorage.getItem(ONBELLEK) || '{}'); } catch(e){}
      var dosyalar = sonuc.dosyalar, okunacak = [];
      dosyalar.forEach(function(f){
        var a = f.name + '|' + f.size + '|' + f.lastModified;
        f._anahtar = a;
        if(!(a in onb)) okunacak.push(f);
      });
      belgeDurum.klasor = sonuc.ad; belgeDurum.toplamPdf = dosyalar.length;
      var i = 0;
      function sonraki(){
        if(i >= okunacak.length) return Promise.resolve();
        var f = okunacak[i++];
        belgeDurum.tarama = 'PDF okunuyor ' + i + ' / ' + okunacak.length;
        if(i % 5 === 1) belgePanelCiz();
        return pdfHaneNo(f).then(function(h){ onb[f._anahtar] = h; return sonraki(); });
      }
      return sonraki().then(function(){
        /* önbelleği klasörde artık olmayan dosyalardan temizle */
        var temiz = {};
        dosyalar.forEach(function(f){ temiz[f._anahtar] = onb[f._anahtar] || ''; });
        try { localStorage.setItem(ONBELLEK, JSON.stringify(temiz)); } catch(e){}
        belgeDosya = {};
        dosyalar.forEach(function(f){
          var h = temiz[f._anahtar];
          if(!h) return;
          if(!belgeDosya[h] || f.lastModified > belgeDosya[h].lastModified) belgeDosya[h] = f;
        });
        tumKayitlar().forEach(function(k){
          var h = haneTemiz(k.haneNo);
          k.pdf = h && belgeDosya[h] ? 'p_' + h : '';
        });
        belgeTarandi = true;
        belgeDurum.zaman = new Date(); belgeDurum.tarama = '';
        V.noktalar.forEach(function(n){
          var m = isaretler[n.id]; if(!m) return;
          m.setTooltipContent(etiketHtml(n));
          m.setPopupContent(baloncuk(n));
        });
        filtreUygula();
        if(el('panelListe').classList.contains('acik')) listeCiz();
        belgePanelCiz();
        var say = belgeSayilari();
        bildir(say.belgeli + ' / ' + say.hane + ' hanenin belgesi bulundu');
      });
    }
    function belgeleriKontrol(yeniKlasor){
      return klasordenDosyalar(yeniKlasor).then(belgeleriTara).catch(function(e){
        belgeDurum.tarama = '';
        if(e && e.name === 'AbortError') return;
        bildir('Klasör okunamadı: ' + (e && e.message ? e.message : e));
        belgePanelCiz();
      });
    }
    /* Açılışta: klasör daha önce seçildiyse ve izin hâlâ geçerliyse sessizce tara */
    function belgeOtomatik(){
      if(!window.showDirectoryPicker || !db) return;
      dbAl('meta', 'belgeKlasoru').then(function(h){
        if(!h) return;
        belgeDurum.klasor = h.name;
        return h.queryPermission({ mode:'read' }).then(function(iz){
          if(iz === 'granted') return belgeleriKontrol(false);
          bildir('Belgeleri görmek için Belgeler sekmesinden kontrol edin');
        });
      }).catch(function(){});
    }

    function telefonPaketi(){
      var say = function(secim){
        var hane = 0, adres = 0;
        V.noktalar.forEach(function(n){
          var k = n.kayitlar.filter(function(x){ return secim === 'tumu' || (secim === 'var' ? !!x.pdf : !x.pdf); }).length;
          if(k){ hane += k; adres++; }
        });
        return { hane:hane, adres:adres };
      };
      var ss = { tumu:say('tumu'), var:say('var'), yok:say('yok') };
      var not = function(x){ return x.hane + ' hane · ' + x.adres + ' adres'; };
      var secenekler = [{ deger:'tumu', ad:'Tümü', not:not(ss.tumu) }];
      if(belgeTarandi){
        secenekler.push({ deger:'var', ad:'Belgeli', not:not(ss.var), pasif:!ss.var.hane });
        secenekler.push({ deger:'yok', ad:'Belgesiz', not:not(ss.yok), pasif:!ss.yok.hane });
      }
      var baslik = belgeTarandi ? 'Hangi haneler aktarılsın?' : 'Belgeler kontrol edilmedi; paket belgesiz hazırlanır';
      secimIste(baslik, secenekler).then(function(secim){
        if(!secim) return;
        var uyar = function(k){ return secim === 'tumu' || (secim === 'var' ? !!k.pdf : !k.pdf); };
        var ek = secim === 'var' ? ' (belgeli)' : secim === 'yok' ? ' (belgesiz)' : '';
        var noktalar = V.noktalar.map(function(n){
          var kl = n.kayitlar.filter(uyar);
          if(!kl.length) return null;
          return { id:n.id, lat:n.lat, lng:n.lng, mahalle:n.mahalle, cadde:n.cadde, kapi:n.kapi,
                   pinAd:n.pinAd, fa:n.fa || '', snf:n.snf,
                   kayitlar: kl.map(function(k){
                     return { id:k.id, ad:k.ad || '', kimlik:k.kimlik || '', daire:k.daire || '',
                              tel:k.tel || '', telUlus:k.telUlus || '', telNs:k.telNs || '',
                              haneNo:k.haneNo || '', kisi:k.kisi || '', yardim:k.yardim || '', tarih:k.tarih || '',
                              adres:[n.mahalle, etiketMetni(n)].filter(Boolean).join(', '), pdf:k.pdf || '' };
                   }) };
        }).filter(Boolean);
        var kimlikler = [];
        noktalar.forEach(function(n){ n.kayitlar.forEach(function(k){ kimlikler.push(k.id); }); });
        var veri = { tur:'saha-harita-paket', surum:1, olusturma:new Date().toISOString(),
                     baslik:(V.baslik || 'Saha') + ek, kaynak:'Saha haritası', mahalleRenk:V.mahalleRenk || {},
                     noktalar:noktalar, konumsuz:[], depoAnahtar:'saha_' + karma(kimlikler.sort().join(',')) };
        var gerekli = [];
        noktalar.forEach(function(n){ n.kayitlar.forEach(function(k){
          var h = haneTemiz(k.haneNo);
          if(k.pdf && belgeDosya[h] && gerekli.indexOf(h) === -1) gerekli.push(h);
        }); });
        bildir('Paket hazırlanıyor…');
        var parcalar = [JSON.stringify(veri).slice(0, -1) + ',"pdfler":{'];
        var i = 0;
        function sonraki(){
          if(i >= gerekli.length) return Promise.resolve();
          var h = gerekli[i++], f = belgeDosya[h];
          return dosyaBase64(f).then(function(b64){
            parcalar.push((i > 1 ? ',' : '') + JSON.stringify('p_' + h) + ':' + JSON.stringify({ ad:f.name, sayfa:0, veri:b64 }));
            return sonraki();
          });
        }
        sonraki().then(function(){
          parcalar.push('}}');
          var blob = new Blob(parcalar, { type:'application/json' });
          indirBlob(blob, dosyaAdiTemiz('saha-paketi-' + veri.baslik) + '.json');
          bildir('Telefon paketi hazır: ' + noktalar.length + ' adres, ' + gerekli.length + ' belge, ' +
                 (blob.size / 1048576).toFixed(1) + ' MB');
        }).catch(function(e){ bildir('Paket hazırlanamadı: ' + (e && e.message ? e.message : e)); });
      });
    }

    /* ---- kurulum ---- */
    function kur(){
      el('baslik').textContent = V.baslik || 'Saha Haritası';
      document.title = 'Saha · ' + (V.baslik || '');
      el('uygulama').style.display = '';
      if(typeof L === 'undefined'){ uyar('Harita kütüphanesi yüklenemedi', ' Sayfayı yenileyin.'); return; }
      secimYukle();
      harita = L.map('harita', { preferCanvas:true, zoomControl:false, tap:false, rotate:true,
                                  rotateControl:false, touchRotate:true, bearing:0 }).setView([41.0066, 28.7832], 13);
      /* Dosyadan açılınca OSM kare vermiyor (Referer yok): varsayılan Carto (OSM verisi) */
      var kz = 0;
      if(DOSYADAN) ZEMINLER.forEach(function(z, i){ if(z.sunucu === 'carto') kz = i; });
      try {
        var z = parseInt(localStorage.getItem(DOSYADAN ? 'saha_zemin_dosya' : 'saha_zemin_v2'), 10);
        if(!isNaN(z) && z >= 0 && z < ZEMINLER.length && !(DOSYADAN && ZEMINLER[z].dosyadaYok)) kz = z;
      } catch(e){}
      zeminSec(kz, true);

      kumeVar = (typeof L.markerClusterGroup === 'function') && V.noktalar.length > 150;
      katman = kumeVar
        ? L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 17, chunkedLoading: true })
        : L.layerGroup();
      katman.addTo(harita);
      V.noktalar.forEach(function(n){
        var m = L.circleMarker([n.lat, n.lng], stilVer(n));
        m.bindPopup(function(){ return baloncuk(n); }, { maxWidth: 300, minWidth: 292, autoPanPaddingTopLeft: [12, 12], autoPanPaddingBottomRight: [60, 16] });
        m.bindTooltip(etiketHtml(n), { permanent:true, direction:'right', offset:[7, 0],
                                             className:'etiket', interactive:false });
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
      function belgeSegmentCiz(){
        document.querySelectorAll('#belgeSegment button').forEach(function(x){
          x.classList.toggle('etkin', x.getAttribute('data-belge') === belgeFiltre);
        });
      }
      document.querySelectorAll('#belgeSegment button').forEach(function(d){
        d.onclick = function(){
          if(GOMULU && !belgeTarandi && d.getAttribute('data-belge') !== 'tumu'){
            bildir('Önce Belgeler sekmesinden belgeleri kontrol edin'); return;
          }
          belgeFiltre = d.getAttribute('data-belge');
          try { localStorage.setItem('saha_belge_filtre', belgeFiltre); } catch(e){}
          belgeSegmentCiz(); filtreIsaretiGuncelle(); filtreUygula();
          if(el('panelListe').classList.contains('acik')) listeCiz();
        };
      });
      belgeSegmentCiz(); filtreIsaretiGuncelle(); filtreUygula();
      document.querySelectorAll('#durumSegment button').forEach(function(d){
        d.onclick = function(){
          durumFiltre = d.getAttribute('data-durum');
          document.querySelectorAll('#durumSegment button').forEach(function(x){ x.classList.toggle('etkin', x === d); });
          filtreIsaretiGuncelle(); filtreUygula();
          if(el('panelListe').classList.contains('acik')) listeCiz();
        };
      });
      el('dgHarita').onclick = kapatPanel;
      el('dgListe').onclick = function(){ if(panelAc('panelListe', 'dgListe')){ listeCiz(); secimBarGuncelle(); } };
      el('dgIst').onclick = function(){ if(panelAc('panelIst', 'dgIst')) istatistikCiz(); };
      if(GOMULU){
        el('dgPaket').innerHTML = ik('belge') + '<span>Belgeler</span>';
        el('panelPaket').querySelector('.pb span').textContent = 'Belgeler';
        el('dgPaket').onclick = function(){ if(panelAc('panelPaket', 'dgPaket')) belgePanelCiz(); };
        belgeOtomatik();
      }else{
        el('dgPaket').onclick = function(){ if(panelAc('panelPaket', 'dgPaket')) paketCiz(); };
      }
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
      el('dgKonum').onclick = konumDugmesi;
      konumIkonu();
      el('dgPusula').innerHTML = PUSULA_SVG;
      harita.on('dragstart', function(){
        takip = false;
        if(yonModu) yonModuKapat(false);          /* elle kaydırınca yön takibi de durur, açı kalır */
        konumIkonu();
      });
      harita.on('rotate', pusulaGuncelle);
      el('dgPusula').onclick = function(){ if(yonModu) yonModuKapat(false); harita.setBearing(0); pusulaGuncelle(); };
      harita.on('zoomend', etiketGorunurluk);
      etiketGorunurluk();
      /* Uygulama açılınca konumu göstermeye başla; arka planda pil harcamasın */
      konumIzle();
      document.addEventListener('visibilitychange', function(){
        if(document.hidden){ konumDurdur(); pusulaDurdur(); }
        else{ konumIzle(); if(yonModu) pusulaBaslat(); }
      });
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
  if(GOMULU){
    var V0 = GOMULU;
    V0.konumsuz = V0.konumsuz || [];
    /* belge durumu her açılışta klasörden yeniden okunur */
    V0.noktalar.forEach(function(n){ n.kayitlar.forEach(function(k){ k.pdf = ''; }); });
    dbAc().then(function(d){ db = d; }).catch(function(){}).then(function(){ sahaBaslat(V0); });
    return;
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
