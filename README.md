# Saha Haritası

Küçükçekmece SYDV saha ziyaretleri için telefon/tablet uygulaması.
Hane adreslerini haritada gösterir; noktaya dokununca o haneye ait PDF belgesi açılır.

**Adres:** https://sadrettin86.github.io/saha-harita/

## Nasıl çalışır

1. Bilgisayardaki *Adres Haritası* aracında (v2.9+) Excel ve PDF'lerin olduğu klasör seçilir, **Başlat** ile adresler konumlanır.
   PDF'ler, içlerindeki **Hane No** ile Excel'in *Hane No* sütunundan eşleştirilir.
2. **Dışa aktar → 📱 Telefon paketi** ile `saha-paketi-….json` alınır.
3. Dosya telefona/tablete gönderilir, bu uygulamada **Telefon paketini seç** ile açılır.

## Bilgisayarda: saha haritası dosyası

PC aracının **Dışa aktar → Saha haritası** çıktısı da bu sitedeki arayüzü (`ui.js`, `app.js`, `app.css`) kullanır;
dosyanın içinde yalnızca veri bulunur. Bu kipte belgeler, **Belgeler** sekmesinden seçilen klasörden
(genelde İndirilenler) okunur ve oradan telefon paketi oluşturulabilir. Dosyadan açılınca OpenStreetMap
kare vermediği için varsayılan zemin Carto'dur.

## Gizlilik

Bu depoda yalnızca uygulamanın kodu vardır; hane bilgisi, PDF veya API anahtarı yoktur.
Paket, açıldığı cihazın içinde (IndexedDB) saklanır ve hiçbir sunucuya gönderilmez.

## Kullanılan kütüphaneler

- [Leaflet](https://leafletjs.com) 1.9.4 ve Leaflet.markercluster 1.5.3 (BSD-2 / MIT)
- [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174, legacy derleme (Apache-2.0)

Harita zemini: Esri, CARTO, OpenStreetMap.

## Güncelleme

Dosyalar değişince `sw.js` içindeki `SURUM` değişmelidir (liste ve sürüm `tools/sw_uret.py` ile üretilir);
uygulama yeni sürümü bir sonraki açılışta alır.
