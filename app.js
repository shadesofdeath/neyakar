"use strict";

/* ---------- Yardımcılar ---------- */
const $ = (id) => document.getElementById(id);
const ROAD_FACTOR = 1.27; // kuş uçuşu -> tahmini karayolu mesafesi katsayısı
const FUEL_LABELS = { benzin: "Benzin", dizel: "Dizel", lpg: "LPG", elektrik: "Elektrik" };

const fmtTRY = (n) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: n < 100 ? 2 : 0,
  }).format(n);

const fmtNum = (n, d = 0) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: d }).format(n);

/** Türkçe kurallı baş harf büyütme ("kadıköy" -> "Kadıköy"). */
const titleCase = (s) =>
  s.replace(/(^|[\s\-\/])([a-zçğıöşü])/g, (m, p, c) => p + c.toLocaleUpperCase("tr"));

/** Süreyi "2 sa 15 dk" biçiminde göster. */
const fmtDur = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
};

/** İki koordinat arası büyük daire mesafesi (km). */
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rota ücret anahtarı (alfabetik). */
const routeKey = (a, b) => [a, b].sort((x, y) => x.localeCompare(y, "tr")).join("|");

/* ---------- Durum ---------- */
const state = {
  mode: "cities", // "cities" | "manual"
  fuel: "benzin",
  tollTouched: false, // kullanıcı toll/bridge alanına elle dokundu mu?
  bridgeTouched: false,
};

/* ---------- Şehir seçimlerini doldur ---------- */
function populateCities() {
  const from = $("fromCity");
  const to = $("toCity");
  const opts = CITIES.map((c) => `<option value="${c.name}">${c.name}</option>`).join("");
  from.innerHTML = opts;
  to.innerHTML = opts;
  from.value = "İstanbul";
  to.value = "Ankara";
}

/** Seçili şehirlere göre tahmini mesafe (km) veya null. */
function getCityDistance() {
  const from = CITIES.find((c) => c.name === $("fromCity").value);
  const to = CITIES.find((c) => c.name === $("toCity").value);
  if (!from || !to) return null;
  if (from.name === to.name) return 0;
  return Math.round(haversineKm(from, to) * ROAD_FACTOR);
}

/** Seçili ile göre ilçe listesini doldur. */
function populateDistricts(citySelId, distSelId) {
  const city = $(citySelId).value;
  const list = (typeof DISTRICTS !== "undefined" && DISTRICTS[city]) || [];
  $(distSelId).innerHTML =
    `<option value="">İl geneli / merkez</option>` +
    list.map((d) => `<option value="${d}">${titleCase(d)}</option>`).join("");
}

/** Şehirler arası modda mesafe notunu ve önerilen ücretleri güncelle. */
function updateCityInfo() {
  const from = $("fromCity").value;
  const to = $("toCity").value;
  const dist = getCityDistance();
  const note = $("autoDistanceNote");

  if (dist === null || from === to) {
    note.textContent = "Farklı iki şehir seçin.";
  } else {
    note.textContent = `Tahmini mesafe: ~${fmtNum(dist)} km (tek yön)`;
  }

  // Bilinen rota için ücret önerisi
  const preset = ROUTE_TOLLS[routeKey(from, to)];
  const hint = $("tollHint");
  if (preset && from !== to) {
    hint.innerHTML =
      `Bu rota için tahmini: Otoyol ${fmtNum(preset.toll)} ₺, Köprü ${fmtNum(preset.bridge)} ₺` +
      (preset.note ? ` · <em>${preset.note}</em>` : "") +
      ` — <button type="button" class="link-btn" id="applyPreset">otomatik doldur</button>`;
    $("applyPreset").addEventListener("click", () => {
      $("tollCost").value = preset.toll;
      $("bridgeCost").value = preset.bridge;
      state.tollTouched = true;
      state.bridgeTouched = true;
    });
  } else {
    hint.textContent = "Bu rota için hazır ücret verisi yok; otoyol ve köprü ücretlerini elle girebilirsin.";
  }
}

/* ---------- Yakıt sekmeleri ---------- */
function setFuel(fuel) {
  state.fuel = fuel;
  document.querySelectorAll(".fuel-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.fuel === fuel)
  );
  const d = FUEL_DEFAULTS[fuel];
  $("consumptionLabel").textContent = d.consLabel;
  $("priceLabel").textContent = d.priceLabel;
  $("consumption").value = d.consumption;
  $("fuelPrice").value = d.price;
}

/* ---------- Araç seçici ---------- */
function populateVehicleBrands() {
  if (typeof VEHICLES === "undefined") return;
  const brand = $("vehicleBrand");
  brand.innerHTML =
    `<option value="">Marka seçin…</option>` +
    Object.keys(VEHICLES).map((b) => `<option value="${b}">${b}</option>`).join("");
}

function populateVehicleModels(brandName) {
  const model = $("vehicleModel");
  const list = VEHICLES[brandName];
  if (!list) {
    model.innerHTML = `<option value="">—</option>`;
    model.disabled = true;
    return;
  }
  model.innerHTML =
    `<option value="">Model seçin…</option>` +
    list.map((v, i) => `<option value="${i}">${v.model}</option>`).join("");
  model.disabled = false;
}

function applyVehicle(brandName, index) {
  const v = (VEHICLES[brandName] || [])[index];
  if (!v) return;
  setFuel(v.fuel); // yakıt türünü ayarlar (tüketim/fiyatı varsayılana çeker)
  $("consumption").value = v.cons; // sonra tüketimi araca göre güncelle
}

/* ---------- Mesafe modu ---------- */
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".seg-btn").forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  $("citiesMode").classList.toggle("hidden", mode !== "cities");
  $("manualMode").classList.toggle("hidden", mode !== "manual");
}

/* ---------- Konum çözümleme & rota (OSM/OSRM) ---------- */
const _geoCache = {};

/** İl merkezi noktası. */
function cityPoint(name, label) {
  const c = CITIES.find((x) => x.name === name);
  return c ? { lat: c.lat, lon: c.lon, label: label || name } : null;
}

/** İl+ilçe -> koordinat. İlçe boş/merkez ise il merkezi; değilse Nominatim (OSM). */
async function geocode(province, district, label) {
  const center = cityPoint(province, label);
  if (!district || district === "merkez") return center;
  const key = province + "|" + district;
  if (_geoCache[key]) return { ...(_geoCache[key]), label: label || _geoCache[key].label };
  try {
    const q = encodeURIComponent(`${district}, ${province}, Türkiye`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${q}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    clearTimeout(t);
    if (res.ok) {
      const arr = await res.json();
      if (arr && arr[0] && isFinite(+arr[0].lat)) {
        const p = { lat: +arr[0].lat, lon: +arr[0].lon, label: label || district };
        _geoCache[key] = p;
        return p;
      }
    }
  } catch { /* yut */ }
  return center; // yedek: il merkezi
}

/** OSRM ile en kısa + alternatif rotalar. Her biri {km, min, geometry}. */
async function getRoadRoutes(from, to) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=full&geometries=geojson&alternatives=true`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || !data.routes.length) return null;
    return data.routes
      .map((r) => ({ km: Math.round(r.distance / 1000), min: Math.round(r.duration / 60), geometry: r.geometry }))
      .sort((a, b) => a.km - b.km);
  } catch {
    return null; // ağ hatası / zaman aşımı -> tahmine düş
  }
}

/* ---------- Rota durumu (alternatifler) ---------- */
let _routes = [];
let _activeRoute = 0;
let _routeLabel = "";
let _routePoints = null;

function applyRoute(i) {
  const r = _routes[i];
  if (!r) return;
  _activeRoute = i;
  renderTrip(r.km, _routeLabel, { estimate: false, points: _routePoints, geometry: r.geometry });
  renderRouteOptions();
}

function renderRouteOptions() {
  const box = $("routeOptions");
  if (!box) return;
  if (!_routes || _routes.length < 2) { box.innerHTML = ""; return; }
  box.innerHTML = _routes
    .map((r, i) =>
      `<button type="button" class="route-opt${i === _activeRoute ? " active" : ""}" data-i="${i}">` +
      `<span class="ro-name">${i === 0 ? "En kısa" : "Alternatif " + i}</span>` +
      `<span class="ro-meta">${fmtNum(r.km)} km · ~${fmtDur(r.min)}</span></button>`
    )
    .join("");
  box.querySelectorAll(".route-opt").forEach((b) =>
    b.addEventListener("click", () => applyRoute(+b.dataset.i))
  );
}

function showLoading() {
  $("resultEmpty").classList.remove("hidden");
  $("resultContent").classList.add("hidden");
  $("resultEmpty").innerHTML =
    `<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-route" /></svg></span>` +
    `<p class="empty-title">Rota hesaplanıyor…</p>` +
    `<p class="empty-desc">Gerçek yol mesafesi getiriliyor.</p>`;
}

/* ---------- Hesaplama ---------- */
async function calculate() {
  // Yakıt doğrulaması (ortak)
  const consumption = parseFloat($("consumption").value);
  const fuelPrice = parseFloat($("fuelPrice").value);
  if (!isFinite(consumption) || consumption < 0 || !isFinite(fuelPrice) || fuelPrice < 0) {
    showError("Tüketim ve yakıt fiyatını kontrol edin.");
    return;
  }

  if (state.mode === "manual") {
    const oneWay = parseFloat($("manualDistance").value);
    if (!isFinite(oneWay) || oneWay <= 0) {
      showError("Lütfen geçerli bir mesafe girin.");
      return;
    }
    _routes = [];
    renderTrip(oneWay, "Manuel mesafe", { estimate: false });
    return;
  }

  // Şehirler modu
  const fromCity = $("fromCity").value, toCity = $("toCity").value;
  const fromDist = $("fromDistrict").value, toDist = $("toDistrict").value;
  if (fromCity === toCity && fromDist === toDist) {
    showError("Lütfen farklı iki nokta seçin.");
    return;
  }
  const lbl = (city, dist) => (dist ? `${city} (${titleCase(dist)})` : city);
  const fromLabel = lbl(fromCity, fromDist), toLabel = lbl(toCity, toDist);
  const routeLabel = `${fromLabel} → ${toLabel}`;

  // İlk gösterim: il merkezleriyle tahmin (yoksa yükleniyor)
  const estPoints = { from: cityPoint(fromCity, fromLabel), to: cityPoint(toCity, toLabel) };
  const estKm = getCityDistance();
  if (estKm && estKm > 0) {
    renderTrip(estKm, routeLabel, { estimate: true, points: estPoints });
  } else {
    showLoading();
  }

  // Gerçek koordinat (ilçe -> OSM) + OSRM rotaları
  const [fp, tp] = await Promise.all([
    geocode(fromCity, fromDist, fromLabel),
    geocode(toCity, toDist, toLabel),
  ]);
  // Kullanıcı bu sırada seçimi değiştirdiyse iptal
  if ($("fromCity").value !== fromCity || $("toCity").value !== toCity ||
      $("fromDistrict").value !== fromDist || $("toDistrict").value !== toDist) return;
  if (!fp || !tp) return; // koordinat yok -> tahmin ekranda kalır

  const routes = await getRoadRoutes(fp, tp);
  if ($("fromCity").value !== fromCity || $("toCity").value !== toCity ||
      $("fromDistrict").value !== fromDist || $("toDistrict").value !== toDist) return;

  if (routes && routes.length) {
    _routes = routes;
    _routeLabel = routeLabel;
    _routePoints = { from: fp, to: tp };
    applyRoute(0);
  } else if (estKm && estKm > 0) {
    // OSRM erişilemedi: tahmini sonucu bırak, düz çizgi harita
    renderTrip(estKm, routeLabel, { estimate: true, points: estPoints });
  } else {
    showError("Rota hesaplanamadı. Lütfen tekrar deneyin.");
  }
}

/** Tek yön mesafeden maliyetleri hesaplayıp sonuç ve haritayı çizer. */
function renderTrip(oneWay, routeLabel, opts = {}) {
  const roundTrip = $("roundTrip").checked;
  const distance = roundTrip ? oneWay * 2 : oneWay;

  const consumption = parseFloat($("consumption").value);
  const fuelPrice = parseFloat($("fuelPrice").value);

  const tripMul = roundTrip ? 2 : 1;
  const toll = (parseFloat($("tollCost").value) || 0) * tripMul;
  const bridge = (parseFloat($("bridgeCost").value) || 0) * tripMul;
  const tollTotal = toll + bridge;

  const persons = Math.max(1, parseInt($("persons").value, 10) || 1);

  const fuelUsed = (distance * consumption) / 100; // L veya kWh
  const fuelCost = fuelUsed * fuelPrice;
  const total = fuelCost + tollTotal;
  const perKm = distance > 0 ? total / distance : 0;
  const perPerson = total / persons;

  renderResult({
    routeLabel:
      routeLabel + (roundTrip ? " · gidiş-dönüş" : "") + (opts.estimate ? " · tahmini" : ""),
    distance,
    fuelUsed,
    fuelCost,
    tollTotal,
    total,
    perKm,
    perPerson,
    persons,
    unit: FUEL_DEFAULTS[state.fuel].unit,
  });

  if (state.mode === "cities" && opts.points && opts.points.from && opts.points.to) {
    showRouteMap(opts.points.from, opts.points.to, opts.geometry);
  } else {
    $("mapCard").classList.add("hidden");
    const box = $("routeOptions"); if (box) box.innerHTML = "";
  }
}

const EMPTY_STATE_HTML =
  `<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-calc" /></svg></span>` +
  `<p class="empty-title">Sonuçlar burada görünecek</p>` +
  `<p class="empty-desc">Formu doldurup <strong>Maliyeti Hesapla</strong>'ya basın.</p>`;

function showError(msg) {
  $("resultEmpty").classList.remove("hidden");
  $("resultContent").classList.add("hidden");
  $("resultEmpty").innerHTML =
    `<span class="empty-icon" style="color:var(--accent);background:var(--accent-soft)"><svg class="icon" aria-hidden="true"><use href="#i-alert" /></svg></span>` +
    `<p class="empty-title">${msg}</p>` +
    `<p class="empty-desc">Bilgileri kontrol edip tekrar deneyin.</p>`;
}

function renderResult(r) {
  $("resultEmpty").classList.add("hidden");
  $("resultContent").classList.remove("hidden");

  $("rTotal").textContent = fmtTRY(r.total);
  $("rRouteLabel").textContent = r.routeLabel;
  $("rDistance").textContent = `${fmtNum(r.distance)} km`;
  $("rFuel").textContent = fmtTRY(r.fuelCost);
  $("rToll").textContent = fmtTRY(r.tollTotal);
  $("rPerKm").textContent = fmtTRY(r.perKm);

  $("rFuelUsed").textContent = `${fmtNum(r.fuelUsed, 1)} ${r.unit}`;
  $("rTollDetail").textContent = fmtTRY(r.tollTotal);

  const perPersonRow = $("rPerPersonRow");
  if (r.persons > 1) {
    perPersonRow.classList.remove("hidden");
    $("rPerPerson").textContent = `${fmtTRY(r.perPerson)} (${r.persons} kişi)`;
  } else {
    perPersonRow.classList.add("hidden");
  }

  // Dağılım çubuğu
  const fuelPct = r.total > 0 ? (r.fuelCost / r.total) * 100 : 0;
  const tollPct = 100 - fuelPct;
  $("barFuel").style.width = `${fuelPct}%`;
  $("barToll").style.width = `${tollPct}%`;
  $("pctFuel").textContent = `${fmtNum(fuelPct)}%`;
  $("pctToll").textContent = `${fmtNum(tollPct)}%`;

  // Yakıt türü karşılaştırması
  renderFuelCompare(r.distance);

  // Paylaşım verisi + adres çubuğu
  updateShare(r);
}

/** Aynı mesafe için tüm yakıt türlerinin tahmini maliyetini karşılaştır. */
function renderFuelCompare(distance) {
  const order = ["benzin", "dizel", "lpg", "elektrik"];
  const userCons = parseFloat($("consumption").value);
  const userPrice = parseFloat($("fuelPrice").value);

  const rows = order.map((f) => {
    const d = FUEL_DEFAULTS[f];
    const cons = f === state.fuel && isFinite(userCons) ? userCons : d.consumption;
    const price = f === state.fuel && isFinite(userPrice) ? userPrice : d.price;
    return { f, cons, price, unit: d.unit, cost: ((distance * cons) / 100) * price, current: f === state.fuel };
  });

  const min = Math.min(...rows.map((r) => r.cost));
  $("fcList").innerHTML = rows
    .sort((a, b) => a.cost - b.cost)
    .map((r) => {
      const cheapest = r.cost === min;
      return (
        `<div class="fc-row${r.current ? " fc-current" : ""}${cheapest ? " fc-cheap" : ""}">` +
        `<span class="fc-name">${FUEL_LABELS[r.f]}` +
        (r.current ? ` <em>seçili</em>` : "") +
        (cheapest ? ` <b class="fc-badge">En ucuz</b>` : "") +
        `</span>` +
        `<span class="fc-cons">${fmtNum(r.cons, 1)} ${r.unit}/100km</span>` +
        `<span class="fc-cost">${fmtTRY(r.cost)}</span>` +
        `</div>`
      );
    })
    .join("");
}

/* ---------- Rota haritası (Leaflet) ---------- */
let _map = null;
let _mapLayer = null;

function showRouteMap(fromPoint, toPoint, geometry) {
  const card = $("mapCard");
  if (typeof L === "undefined" || !fromPoint || !toPoint) { card.classList.add("hidden"); return; }

  card.classList.remove("hidden");

  if (!_map) {
    _map = L.map("map", { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap katkıda bulunanlar",
    }).addTo(_map);
  }
  if (_mapLayer) _mapLayer.remove();

  const a = [fromPoint.lat, fromPoint.lon];
  const b = [toPoint.lat, toPoint.lon];
  const dot = (latlng, color) =>
    L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 });

  // Gerçek rota geometrisi (OSRM GeoJSON: [lon,lat]) varsa onu, yoksa düz çizgi
  const line = geometry && geometry.coordinates
    ? L.polyline(geometry.coordinates.map((c) => [c[1], c[0]]), { color: "#4f46e5", weight: 4, opacity: 0.85 })
    : L.polyline([a, b], { color: "#4f46e5", weight: 4, opacity: 0.75, dashArray: "8 7" });

  _mapLayer = L.layerGroup([
    line,
    dot(a, "#4f46e5").bindTooltip(fromPoint.label || "Başlangıç"),
    dot(b, "#0d9488").bindTooltip(toPoint.label || "Varış"),
  ]).addTo(_map);

  _map.fitBounds(line.getBounds(), { padding: [30, 30] });
  setTimeout(() => _map.invalidateSize(), 60);
}

/* ---------- Paylaşım & bağlantı ---------- */
let lastShare = null; // { url, text }

/** Mevcut form durumunu URL parametrelerine dök. */
function collectParams() {
  const p = new URLSearchParams();
  p.set("m", state.mode === "manual" ? "m" : "c");
  if (state.mode === "cities") {
    p.set("from", $("fromCity").value);
    p.set("to", $("toCity").value);
    if ($("fromDistrict").value) p.set("fd", $("fromDistrict").value);
    if ($("toDistrict").value) p.set("td", $("toDistrict").value);
  } else {
    p.set("d", $("manualDistance").value || "");
  }
  p.set("f", state.fuel);
  p.set("c", $("consumption").value || "");
  p.set("p", $("fuelPrice").value || "");
  p.set("t", $("tollCost").value || "0");
  p.set("b", $("bridgeCost").value || "0");
  p.set("n", $("persons").value || "1");
  p.set("r", $("roundTrip").checked ? "1" : "0");
  return p;
}

function buildShareURL() {
  return location.origin + location.pathname + "?" + collectParams().toString();
}

/** URL parametrelerini forma uygula. Parametre yoksa false döner. */
function applyParamsFromURL() {
  const p = new URLSearchParams(location.search);
  if (![...p.keys()].length) return false;

  setMode(p.get("m") === "m" ? "manual" : "cities");

  // Yakıtı, tüketim/fiyatı ezmeden ÖNCE ayarla
  const fuel = p.get("f");
  if (fuel && FUEL_DEFAULTS[fuel]) setFuel(fuel);

  if (state.mode === "cities") {
    if (p.get("from")) $("fromCity").value = p.get("from");
    if (p.get("to")) $("toCity").value = p.get("to");
    populateDistricts("fromCity", "fromDistrict");
    populateDistricts("toCity", "toDistrict");
    if (p.get("fd")) $("fromDistrict").value = p.get("fd");
    if (p.get("td")) $("toDistrict").value = p.get("td");
    updateCityInfo();
  } else if (p.get("d")) {
    $("manualDistance").value = p.get("d");
  }

  if (p.get("c")) $("consumption").value = p.get("c");
  if (p.get("p")) $("fuelPrice").value = p.get("p");
  if (p.has("t")) { $("tollCost").value = p.get("t"); state.tollTouched = true; }
  if (p.has("b")) { $("bridgeCost").value = p.get("b"); state.bridgeTouched = true; }
  if (p.get("n")) $("persons").value = p.get("n");
  $("roundTrip").checked = p.get("r") === "1";
  return true;
}

/** Sonuçtan paylaşım metni/URL'si üret ve adres çubuğunu güncelle. */
function updateShare(r) {
  const url = buildShareURL();
  const lines = [
    "🚗 NeYakar · Yol maliyeti hesabı",
    r.routeLabel,
    `Toplam: ${fmtTRY(r.total)}`,
  ];
  if (r.persons > 1) lines.push(`Kişi başı: ${fmtTRY(r.perPerson)} (${r.persons} kişi)`);
  lines.push(url);
  lastShare = { url, text: lines.join("\n") };
  history.replaceState(null, "", url);
}

function shareWhatsApp() {
  if (!lastShare) return;
  window.open("https://wa.me/?text=" + encodeURIComponent(lastShare.text), "_blank", "noopener");
}

async function copyLink() {
  if (!lastShare) return;
  const btn = $("copyLink");
  const label = btn.querySelector(".copy-text");
  const done = () => {
    btn.classList.add("copied");
    label.textContent = "Kopyalandı!";
    btn.querySelector("use").setAttribute("href", "#i-check");
    setTimeout(() => {
      btn.classList.remove("copied");
      label.textContent = "Bağlantıyı kopyala";
      btn.querySelector("use").setAttribute("href", "#i-link");
    }, 1800);
  };
  try {
    await navigator.clipboard.writeText(lastShare.url);
    done();
  } catch {
    // Eski tarayıcılar için yedek yöntem
    const t = document.createElement("textarea");
    t.value = lastShare.url;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    try { document.execCommand("copy"); done(); }
    catch { prompt("Bağlantıyı kopyalayın:", lastShare.url); }
    document.body.removeChild(t);
  }
}

/* ---------- Tema ---------- */
function initTheme() {
  const saved = localStorage.getItem("neyakar-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("neyakar-theme", next);
  });
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const use = $("themeToggle").querySelector("use");
  use.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
}

/* ---------- Kurulum ---------- */
function init() {
  initTheme();
  populateCities();
  setFuel("benzin");
  setMode("cities");
  populateDistricts("fromCity", "fromDistrict");
  populateDistricts("toCity", "toDistrict");
  updateCityInfo();

  // Mod sekmeleri
  document.querySelectorAll(".seg-btn").forEach((b) =>
    b.addEventListener("click", () => setMode(b.dataset.mode))
  );

  // Yakıt sekmeleri
  document.querySelectorAll(".fuel-tab").forEach((b) =>
    b.addEventListener("click", () => setFuel(b.dataset.fuel))
  );

  // Araç seçici
  populateVehicleBrands();
  $("vehicleBrand").addEventListener("change", (e) => {
    populateVehicleModels(e.target.value);
  });
  $("vehicleModel").addEventListener("change", (e) => {
    if (e.target.value !== "") applyVehicle($("vehicleBrand").value, +e.target.value);
  });

  // Şehir değişimi (il değişince ilçe listesi yenilenir)
  $("fromCity").addEventListener("change", () => {
    populateDistricts("fromCity", "fromDistrict");
    updateCityInfo();
  });
  $("toCity").addEventListener("change", () => {
    populateDistricts("toCity", "toDistrict");
    updateCityInfo();
  });
  $("swapCities").addEventListener("click", () => {
    const fc = $("fromCity").value, tc = $("toCity").value;
    const fd = $("fromDistrict").value, td = $("toDistrict").value;
    $("fromCity").value = tc; $("toCity").value = fc;
    populateDistricts("fromCity", "fromDistrict");
    populateDistricts("toCity", "toDistrict");
    $("fromDistrict").value = td; $("toDistrict").value = fd;
    updateCityInfo();
  });

  // Toll/bridge elle dokunma takibi
  $("tollCost").addEventListener("input", () => (state.tollTouched = true));
  $("bridgeCost").addEventListener("input", () => (state.bridgeTouched = true));

  // Kişi sayacı
  $("personPlus").addEventListener("click", () => {
    $("persons").value = Math.max(1, (parseInt($("persons").value, 10) || 1) + 1);
  });
  $("personMinus").addEventListener("click", () => {
    $("persons").value = Math.max(1, (parseInt($("persons").value, 10) || 1) - 1);
  });

  // Paylaşım butonları
  $("shareWhatsApp").addEventListener("click", shareWhatsApp);
  $("copyLink").addEventListener("click", copyLink);

  // Form
  $("calcForm").addEventListener("submit", (e) => {
    e.preventDefault();
    calculate();
  });
  $("resetBtn").addEventListener("click", () => {
    setTimeout(() => {
      setMode("cities");
      setFuel("benzin");
      populateCities();
      populateDistricts("fromCity", "fromDistrict");
      populateDistricts("toCity", "toDistrict");
      $("vehicleBrand").value = "";
      populateVehicleModels("");
      _routes = [];
      const ro = $("routeOptions"); if (ro) ro.innerHTML = "";
      $("roundTrip").checked = false;
      $("tollCost").value = "";
      $("bridgeCost").value = "";
      $("persons").value = 1;
      $("manualDistance").value = "";
      state.tollTouched = false;
      state.bridgeTouched = false;
      updateCityInfo();
      $("resultContent").classList.add("hidden");
      $("resultEmpty").classList.remove("hidden");
      $("resultEmpty").innerHTML = EMPTY_STATE_HTML;
      $("mapCard").classList.add("hidden");
      lastShare = null;
      history.replaceState(null, "", location.pathname);
    }, 0);
  });

  // Paylaşılan bağlantıyla açıldıysa: alanları doldur ve otomatik hesapla
  if (applyParamsFromURL()) {
    calculate();
  }
}

document.addEventListener("DOMContentLoaded", init);
