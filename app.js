"use strict";

/* ---------- Yardımcılar ---------- */
const $ = (id) => document.getElementById(id);
const ROAD_FACTOR = 1.27; // kuş uçuşu -> tahmini karayolu mesafesi katsayısı

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

/* ---------- Hesaplama ---------- */
function calculate() {
  // Mesafe (tek yön)
  let oneWay;
  let routeLabel = "";
  if (state.mode === "cities") {
    oneWay = getCityDistance();
    const from = $("fromCity").value;
    const to = $("toCity").value;
    if (oneWay === null || from === to) {
      showError("Lütfen farklı iki şehir seçin.");
      return;
    }
    routeLabel = `${from} → ${to}`;
  } else {
    oneWay = parseFloat($("manualDistance").value);
    if (!isFinite(oneWay) || oneWay <= 0) {
      showError("Lütfen geçerli bir mesafe girin.");
      return;
    }
    routeLabel = "Manuel mesafe";
  }

  const roundTrip = $("roundTrip").checked;
  const distance = roundTrip ? oneWay * 2 : oneWay;

  const consumption = parseFloat($("consumption").value);
  const fuelPrice = parseFloat($("fuelPrice").value);
  if (!isFinite(consumption) || consumption < 0 || !isFinite(fuelPrice) || fuelPrice < 0) {
    showError("Tüketim ve yakıt fiyatını kontrol edin.");
    return;
  }

  // Yol ücretleri: gidiş-dönüşte 2 katı
  const tripMul = roundTrip ? 2 : 1;
  const toll = (parseFloat($("tollCost").value) || 0) * tripMul;
  const bridge = (parseFloat($("bridgeCost").value) || 0) * tripMul;
  const tollTotal = toll + bridge;

  const persons = Math.max(1, parseInt($("persons").value, 10) || 1);

  // Maliyetler
  const fuelUsed = (distance * consumption) / 100; // L veya kWh
  const fuelCost = fuelUsed * fuelPrice;
  const total = fuelCost + tollTotal;
  const perKm = distance > 0 ? total / distance : 0;
  const perPerson = total / persons;

  renderResult({
    routeLabel: routeLabel + (roundTrip ? " · gidiş-dönüş" : ""),
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
}

function showError(msg) {
  $("resultEmpty").classList.remove("hidden");
  $("resultContent").classList.add("hidden");
  $("resultEmpty").innerHTML =
    `<div class="empty-emoji">⚠️</div><p>${msg}</p>`;
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
  $("themeToggle").querySelector(".theme-icon").textContent = theme === "dark" ? "☀️" : "🌙";
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
      $("resultEmpty").innerHTML =
        `<div class="empty-emoji">🧮</div><p>Bilgileri doldur ve <strong>Hesapla</strong>'ya bas.<br />Sonuçlar burada görünecek.</p>`;
    }, 0);
  });
}

document.addEventListener("DOMContentLoaded", init);
