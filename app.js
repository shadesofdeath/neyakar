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

/* ---------- Gerçek karayolu mesafesi (OSRM) ---------- */
/** İki koordinat arası gerçek sürüş mesafesi (km) + rota geometrisi, yoksa null. */
async function getRoadDistance(from, to) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes && data.routes[0];
    if (!route || !isFinite(route.distance)) return null;
    return { km: Math.round(route.distance / 1000), geometry: route.geometry };
  } catch {
    return null; // ağ hatası / zaman aşımı -> tahmine düş
  }
}

/* ---------- Hesaplama ---------- */
async function calculate() {
  let oneWay, routeLabel, fromName = "", toName = "";

  if (state.mode === "cities") {
    oneWay = getCityDistance();
    fromName = $("fromCity").value;
    toName = $("toCity").value;
    if (oneWay === null || fromName === toName) {
      showError("Lütfen farklı iki şehir seçin.");
      return;
    }
    routeLabel = `${fromName} → ${toName}`;
  } else {
    oneWay = parseFloat($("manualDistance").value);
    if (!isFinite(oneWay) || oneWay <= 0) {
      showError("Lütfen geçerli bir mesafe girin.");
      return;
    }
    routeLabel = "Manuel mesafe";
  }

  const consumption = parseFloat($("consumption").value);
  const fuelPrice = parseFloat($("fuelPrice").value);
  if (!isFinite(consumption) || consumption < 0 || !isFinite(fuelPrice) || fuelPrice < 0) {
    showError("Tüketim ve yakıt fiyatını kontrol edin.");
    return;
  }

  // Şehirler modunda önce tahminle göster, sonra gerçek yol mesafesiyle güncelle
  renderTrip(oneWay, routeLabel, { estimate: state.mode === "cities" });

  if (state.mode === "cities") {
    const from = CITIES.find((c) => c.name === fromName);
    const to = CITIES.find((c) => c.name === toName);
    const road = await getRoadDistance(from, to);
    // Yanıt gelene kadar kullanıcı yeni bir hesap yapmadıysa uygula
    if (road && $("fromCity").value === fromName && $("toCity").value === toName) {
      renderTrip(road.km, routeLabel, { estimate: false, geometry: road.geometry });
    }
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

  if (state.mode === "cities") {
    showRouteMap($("fromCity").value, $("toCity").value, opts.geometry);
  } else {
    $("mapCard").classList.add("hidden");
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

function showRouteMap(fromName, toName, geometry) {
  const card = $("mapCard");
  if (typeof L === "undefined") { card.classList.add("hidden"); return; } // Leaflet yüklenmedi
  const from = CITIES.find((c) => c.name === fromName);
  const to = CITIES.find((c) => c.name === toName);
  if (!from || !to || from.name === to.name) { card.classList.add("hidden"); return; }

  card.classList.remove("hidden");

  if (!_map) {
    _map = L.map("map", { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap katkıda bulunanlar",
    }).addTo(_map);
  }
  if (_mapLayer) _mapLayer.remove();

  const a = [from.lat, from.lon];
  const b = [to.lat, to.lon];
  const dot = (latlng, color) =>
    L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 });

  // Gerçek rota geometrisi (OSRM GeoJSON: [lon,lat]) varsa onu, yoksa düz çizgi
  const line = geometry && geometry.coordinates
    ? L.polyline(geometry.coordinates.map((c) => [c[1], c[0]]), { color: "#4f46e5", weight: 4, opacity: 0.85 })
    : L.polyline([a, b], { color: "#4f46e5", weight: 4, opacity: 0.75, dashArray: "8 7" });

  _mapLayer = L.layerGroup([
    line,
    dot(a, "#4f46e5").bindTooltip(from.name),
    dot(b, "#0d9488").bindTooltip(to.name),
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

  // Şehir değişimi
  $("fromCity").addEventListener("change", updateCityInfo);
  $("toCity").addEventListener("change", updateCityInfo);
  $("swapCities").addEventListener("click", () => {
    const f = $("fromCity").value;
    $("fromCity").value = $("toCity").value;
    $("toCity").value = f;
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
      $("vehicleBrand").value = "";
      populateVehicleModels("");
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
