# ⛽ NeYakar

Şehirler arası yolculuğun **yakıt + otoyol (HGS/OGS) + köprü + toplam** maliyetini anında hesaplayan, modern ve mobil uyumlu bir web uygulaması. Vanilla JavaScript ile yazıldı, herhangi bir bağımlılık yok — **GitHub Pages** üzerinde doğrudan çalışır.

## ✨ Özellikler

- 🚗 **Yakıt hesaplama** — Benzin, Dizel, LPG ve Elektrik için tüketim (L/100 km veya kWh/100 km) ve güncel fiyat girişi.
- 🛣️ **Yol masrafları** — Otoyol (HGS/OGS) ve köprü ücretleri, gidiş-dönüş seçeneği.
- 📍 **Şehirler arası mesafe** — 81 il arasında otomatik mesafe tahmini (örn. İstanbul → Ankara). Koordinat tabanlı hesaplama olduğu için API/anahtar gerektirmez.
- 👥 **Kişi başı maliyet** — Masrafı kaç kişinin paylaşacağını gir, kişi başına düşen tutarı gör.
- 📊 **Detaylı sonuç ekranı** — Toplam mesafe, yakıt maliyeti, HGS/OGS + köprü, toplam maliyet, km başına maliyet ve dağılım grafiği.
- 🌙 **Açık / koyu tema** — Tercih tarayıcıda hatırlanır.

## 🧮 Mesafe nasıl hesaplanır?

Şehir merkezlerinin koordinatları üzerinden iki nokta arası kuş uçuşu (haversine) mesafe bulunur ve tahmini karayolu mesafesi için `~1.27` dolambaç katsayısıyla çarpılır. Sonuçlar tahminidir; kesin değerler için harita servislerini kontrol edin. Dilerseniz **Manuel** moduyla mesafeyi kendiniz de girebilirsiniz.

Popüler bazı rotalar (İstanbul–Ankara, İstanbul–İzmir, Bursa vb.) için tahmini otoyol/köprü ücretleri hazır gelir; "otomatik doldur" ile alanlara yerleştirilir.

## 🚀 GitHub Pages ile yayınlama

1. Bu depoyu GitHub'a gönderin.
2. **Settings → Pages** bölümüne gidin.
3. **Source** olarak `Deploy from a branch` seçin, branch olarak `main` (ya da yayınlamak istediğiniz branch) ve klasör olarak `/ (root)` seçin.
4. Kaydedin. Birkaç dakika içinde `https://<kullanıcı-adı>.github.io/<depo-adı>/` adresinde yayında olur.

Yerelde denemek için sadece `index.html` dosyasını tarayıcıda açmanız yeterli (build gerekmez).

## 📁 Dosya yapısı

```
index.html   → Arayüz
style.css    → Modern tema (açık/koyu), responsive tasarım
app.js       → Hesaplama mantığı ve etkileşimler
cities.js    → 81 il koordinatları, rota ücret önerileri, yakıt varsayılanları
```

## ⚠️ Not

Yakıt fiyatları ve otoyol/köprü ücretleri tahmini varsayılanlardır ve zamanla değişir. Doğru sonuç için güncel değerleri girin.
