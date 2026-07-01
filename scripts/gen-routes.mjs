/**
 * SEO rota sayfaları üreteci.
 * cities.js içindeki CITIES / ROUTE_TOLLS / FUEL_DEFAULTS verisini okuyup
 * popüler şehir çiftleri için /rota/<slug>.html statik sayfaları,
 * /rota/index.html dizini, sitemap.xml ve robots.txt üretir.
 *
 * Çalıştırma:  node scripts/gen-routes.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://neyakar.net";

/* --- cities.js verisini yükle (tarayıcı globalleri) --- */
const citiesCode = fs.readFileSync(path.join(ROOT, "cities.js"), "utf8");
const { CITIES, ROUTE_TOLLS, FUEL_DEFAULTS } = new Function(
  citiesCode + "\nreturn { CITIES, ROUTE_TOLLS, FUEL_DEFAULTS };"
)();

const ROAD_FACTOR = 1.27;

/* --- yardımcılar --- */
const TR_MAP = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
const slug = (s) =>
  s.replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR_MAP[c] || c).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const routeKey = (a, b) => [a, b].sort((x, y) => x.localeCompare(y, "tr")).join("|");

function haversineKm(a, b) {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const cityDistance = (a, b) => Math.round(haversineKm(a, b) * ROAD_FACTOR);
const fmtTRY = (n) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);
const findCity = (name) => CITIES.find((c) => c.name === name);

/* --- popüler rota çiftleri --- */
const PAIRS = [
  ["İstanbul", "Ankara"], ["İstanbul", "İzmir"], ["İstanbul", "Bursa"], ["İstanbul", "Antalya"],
  ["İstanbul", "Kocaeli"], ["İstanbul", "Tekirdağ"], ["İstanbul", "Eskişehir"], ["İstanbul", "Samsun"],
  ["İstanbul", "Trabzon"], ["İstanbul", "Gaziantep"], ["İstanbul", "Konya"], ["İstanbul", "Adana"],
  ["İstanbul", "Balıkesir"], ["İstanbul", "Çanakkale"],
  ["Ankara", "İzmir"], ["Ankara", "Antalya"], ["Ankara", "Adana"], ["Ankara", "Gaziantep"],
  ["Ankara", "Konya"], ["Ankara", "Samsun"], ["Ankara", "Trabzon"], ["Ankara", "Bursa"],
  ["Ankara", "Kayseri"], ["Ankara", "Eskişehir"], ["Ankara", "Diyarbakır"], ["Ankara", "Erzurum"],
  ["İzmir", "Antalya"], ["İzmir", "Bursa"], ["İzmir", "Denizli"], ["İzmir", "Muğla"], ["İzmir", "Aydın"],
  ["Antalya", "Konya"], ["Antalya", "Denizli"], ["Adana", "Gaziantep"], ["Adana", "Mersin"],
  ["Bursa", "Balıkesir"], ["Samsun", "Trabzon"], ["Konya", "Mersin"],
];

/* --- tekilleştir --- */
const seen = new Set();
const routes = [];
for (const [from, to] of PAIRS) {
  const key = routeKey(from, to);
  if (seen.has(key)) continue;
  const a = findCity(from), b = findCity(to);
  if (!a || !b) continue;
  seen.add(key);
  routes.push({ from, to, a, b, dist: cityDistance(a, b), toll: ROUTE_TOLLS[key] || null });
}
routes.sort((x, y) => x.from.localeCompare(y.from, "tr") || x.to.localeCompare(y.to, "tr"));

/* --- ortak parçalar --- */
const AD_HEAD = `  <script async
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
    crossorigin="anonymous"></script>`;
const AD_SLOT = `      <aside class="ad-slot" aria-label="Reklam">
        <span class="ad-label">Reklam</span>
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="2222222222" data-ad-format="auto" data-full-width-responsive="true"></ins>
      </aside>`;
const AD_INIT = `  <script>(function(){document.querySelectorAll("ins.adsbygoogle").forEach(function(){try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){}});})();</script>
  <!-- Monetag In-Page Push -->
  <script>(function(s){s.dataset.zone='11225561',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>`;
const THEME_INIT = `  <script>try{var t=localStorage.getItem("neyakar-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}</script>`;
const BRAND = `  <header class="topbar">
    <a class="brand" href="../" aria-label="NeYakar ana sayfa">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M9 22V11a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v11M9 16h10M20 12l2 2v6a1.5 1.5 0 0 0 3 0v-8l-3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="brand-text"><span class="brand-name">NeYakar</span><span class="brand-tag">Yol Maliyeti Hesaplayıcı</span></span>
    </a>
  </header>`;
const FOOTER = `  <footer class="footer">
    <span>NeYakar</span><span class="footer-sep">·</span>
    <a href="index.html" style="color:inherit">Popüler rotalar</a><span class="footer-sep">·</span>
    <a href="../" style="color:inherit">Hesaplayıcı</a>
  </footer>`;

function fuelCostRow(r, fuelKey) {
  const d = FUEL_DEFAULTS[fuelKey];
  const cost = (r.dist * d.consumption / 100) * d.price;
  return { name: fuelKey, cost, cons: d.consumption, unit: d.unit };
}

function ctaHref(r) {
  const p = new URLSearchParams({ m: "c", from: r.from, to: r.to, f: "benzin" });
  if (r.toll) { p.set("t", String(r.toll.toll)); p.set("b", String(r.toll.bridge)); }
  return "../?" + p.toString();
}

function routePage(r) {
  const fuels = ["benzin", "dizel", "lpg", "elektrik"].map((f) => fuelCostRow(r, f));
  const labels = { benzin: "Benzin", dizel: "Dizel", lpg: "LPG", elektrik: "Elektrik" };
  const cheapest = Math.min(...fuels.map((f) => f.cost));
  const tollTxt = r.toll
    ? `Bu rota için tahmini geçiş ücretleri: otoyol (HGS/OGS) ${fmtNum(r.toll.toll)} ₺${r.toll.bridge ? `, köprü ${fmtNum(r.toll.bridge)} ₺` : ""}${r.toll.note ? ` (${r.toll.note})` : ""}.`
    : `Bu rota için otoyol/köprü ücreti verisi girilmemiştir; hesaplayıcıda elle ekleyebilirsiniz.`;
  const rows = fuels
    .map((f) => `<tr${f.cost === cheapest ? ' class="row-cheap"' : ""}><td>${labels[f.name]}</td><td>${fmtNum(f.cons)} ${f.unit}/100km</td><td>${fmtTRY(f.cost)}</td><td>${fmtTRY(f.cost * 2)}</td></tr>`)
    .join("\n            ");

  // ilgili rotalar (aynı şehirden çıkan)
  const related = routes
    .filter((x) => x !== r && (x.from === r.from || x.to === r.from || x.from === r.to || x.to === r.to))
    .slice(0, 6)
    .map((x) => `<li><a href="${slug(x.from)}-${slug(x.to)}.html">${x.from} → ${x.to}</a></li>`)
    .join("\n          ");

  const title = `${r.from} - ${r.to} Yakıt ve Yol Maliyeti Hesaplama`;
  const desc = `${r.from} ${r.to} arası tahmini mesafe ~${fmtNum(r.dist)} km. Benzin, dizel, LPG ve elektrikli araç için yakıt, otoyol (HGS/OGS) ve köprü maliyetini hesaplayın.`;
  const canonical = `${SITE_URL}/rota/${slug(r.from)}-${slug(r.to)}.html`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | NeYakar</title>
  <meta name="description" content="${desc}" />
  <meta name="theme-color" content="#4f46e5" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" href="../favicon.svg" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
${AD_HEAD}
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"NeYakar","item":"${SITE_URL}/"},
    {"@type":"ListItem","position":2,"name":"Popüler rotalar","item":"${SITE_URL}/rota/"},
    {"@type":"ListItem","position":3,"name":"${r.from} - ${r.to}","item":"${canonical}"}
  ]}
  </script>
${THEME_INIT}
</head>
<body>
${BRAND}
  <main class="container">
    <article class="content" style="margin-top:24px">
      <h1 class="content-title" style="text-align:left">${r.from} → ${r.to} yol maliyeti</h1>
      <p class="content-lead" style="text-align:left;margin-left:0">
        ${r.from} ile ${r.to} arası tahmini karayolu mesafesi <strong>~${fmtNum(r.dist)} km</strong> (tek yön).
        Aşağıda farklı yakıt türleri için tahmini yakıt maliyeti verilmiştir. Kendi aracınızın tüketimi ve
        güncel yakıt fiyatıyla kesin sonucu almak için hesaplayıcıyı kullanın.
      </p>

      <div class="route-table-wrap">
        <table class="route-table">
          <thead><tr><th>Yakıt</th><th>Tüketim</th><th>Tek yön</th><th>Gidiş-dönüş</th></tr></thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <p class="hint" style="margin-top:12px">${tollTxt}</p>

      <p style="margin:22px 0">
        <a class="btn-primary" href="${ctaHref(r)}" style="display:inline-flex;text-decoration:none;max-width:340px">
          ${r.from} → ${r.to} maliyetini hesapla
        </a>
      </p>

${AD_SLOT}

      <h2 class="content-title" style="text-align:left;font-size:20px;margin-top:32px">Nasıl hesaplanır?</h2>
      <p class="content-lead" style="text-align:left;margin-left:0">
        Maliyet, mesafe × 100 km'deki tüketim × yakıt fiyatı ile bulunan yakıt giderine otoyol (HGS/OGS) ve
        köprü ücretlerinin eklenmesiyle hesaplanır. Yolcu sayısını girerek kişi başı tutarı da görebilirsiniz.
        Mesafeler şehir merkezleri arası tahminidir; kesin değer için hesaplayıcıdaki "Manuel mesafe" modunu kullanın.
      </p>

      ${related ? `<h2 class="content-title" style="text-align:left;font-size:20px;margin-top:28px">İlgili rotalar</h2>
      <ul class="route-links">
          ${related}
      </ul>` : ""}
    </article>
  </main>
${FOOTER}
${AD_INIT}
</body>
</html>
`;
}

function indexPage() {
  const items = routes
    .map((r) => `        <li><a href="${slug(r.from)}-${slug(r.to)}.html">${r.from} → ${r.to} <span>~${fmtNum(r.dist)} km</span></a></li>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Popüler Rotalar — Yol Maliyeti | NeYakar</title>
  <meta name="description" content="Türkiye'nin popüler şehirler arası rotaları için yakıt, otoyol (HGS/OGS) ve köprü maliyeti. İstanbul-Ankara, İstanbul-İzmir ve daha fazlası." />
  <meta name="theme-color" content="#4f46e5" />
  <link rel="canonical" href="${SITE_URL}/rota/" />
  <link rel="icon" href="../favicon.svg" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
${AD_HEAD}
${THEME_INIT}
</head>
<body>
${BRAND}
  <main class="container">
    <article class="content" style="margin-top:24px">
      <h1 class="content-title">Popüler rotalar</h1>
      <p class="content-lead">Şehirler arası yolculuğun yakıt, otoyol ve köprü maliyetini görmek için bir rota seçin.</p>
      <ul class="route-links route-links-grid">
${items}
      </ul>
    </article>
  </main>
${FOOTER}
${AD_INIT}
</body>
</html>
`;
}

function sitemap() {
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/rota/`,
    ...routes.map((r) => `${SITE_URL}/rota/${slug(r.from)}-${slug(r.to)}.html`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
}

/* --- yaz --- */
const outDir = path.join(ROOT, "rota");
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
for (const r of routes) {
  fs.writeFileSync(path.join(outDir, `${slug(r.from)}-${slug(r.to)}.html`), routePage(r));
  n++;
}
fs.writeFileSync(path.join(outDir, "index.html"), indexPage());
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap());
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`${n} rota sayfası + index + sitemap.xml + robots.txt üretildi.`);
