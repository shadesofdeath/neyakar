/**
 * Türkiye'de yaygın araçların yaklaşık ortalama (kombine) yakıt tüketimi.
 * consumption: benzin/dizel/LPG için L/100 km, elektrik için kWh/100 km.
 * Değerler üreticinin ortalama beyanına dayalı tahminlerdir; sürüme göre
 * değişebilir. Kullanıcı sonucu her zaman elle düzeltebilir.
 *
 * Marka -> model listesi. Listede olmayan araçlar için "Genel / Segment"
 * grubu yaklaşık değerler sunar.
 */
const VEHICLES = {
  "Genel / Segment": [
    { model: "Küçük otomobil (hatchback)", fuel: "benzin", cons: 6.0 },
    { model: "Orta sınıf sedan", fuel: "benzin", cons: 6.8 },
    { model: "Kompakt dizel", fuel: "dizel", cons: 4.8 },
    { model: "SUV (benzin)", fuel: "benzin", cons: 8.0 },
    { model: "SUV (dizel)", fuel: "dizel", cons: 5.8 },
    { model: "LPG'li otomobil", fuel: "lpg", cons: 8.5 },
    { model: "Elektrikli otomobil", fuel: "elektrik", cons: 16 },
    { model: "Ticari / Van (dizel)", fuel: "dizel", cons: 7.5 },
    { model: "Motosiklet", fuel: "benzin", cons: 3.5 },
  ],
  "Fiat": [
    { model: "Egea 1.0 (benzin)", fuel: "benzin", cons: 5.8 },
    { model: "Egea 1.4 Fire (benzin)", fuel: "benzin", cons: 6.5 },
    { model: "Egea 1.6 Multijet (dizel)", fuel: "dizel", cons: 4.5 },
    { model: "Panda (benzin)", fuel: "benzin", cons: 5.5 },
    { model: "Doblo (dizel)", fuel: "dizel", cons: 5.5 },
  ],
  "Renault": [
    { model: "Clio (benzin)", fuel: "benzin", cons: 5.8 },
    { model: "Taliant / Symbol (benzin)", fuel: "benzin", cons: 5.9 },
    { model: "Megane (benzin)", fuel: "benzin", cons: 6.5 },
    { model: "Megane (dizel)", fuel: "dizel", cons: 4.5 },
    { model: "Captur (benzin)", fuel: "benzin", cons: 6.4 },
  ],
  "Volkswagen": [
    { model: "Polo (benzin)", fuel: "benzin", cons: 5.6 },
    { model: "Golf (benzin)", fuel: "benzin", cons: 6.2 },
    { model: "Golf (dizel)", fuel: "dizel", cons: 4.6 },
    { model: "Passat (dizel)", fuel: "dizel", cons: 5.0 },
    { model: "Tiguan (dizel)", fuel: "dizel", cons: 5.8 },
  ],
  "Ford": [
    { model: "Fiesta (benzin)", fuel: "benzin", cons: 5.8 },
    { model: "Focus (benzin)", fuel: "benzin", cons: 6.3 },
    { model: "Focus (dizel)", fuel: "dizel", cons: 4.6 },
    { model: "Puma (benzin)", fuel: "benzin", cons: 6.2 },
    { model: "Kuga (dizel)", fuel: "dizel", cons: 5.5 },
  ],
  "Toyota": [
    { model: "Yaris (benzin)", fuel: "benzin", cons: 5.8 },
    { model: "Corolla (benzin)", fuel: "benzin", cons: 6.5 },
    { model: "Corolla Hybrid", fuel: "benzin", cons: 4.5 },
    { model: "C-HR Hybrid", fuel: "benzin", cons: 4.8 },
    { model: "RAV4 (benzin)", fuel: "benzin", cons: 7.5 },
  ],
  "Honda": [
    { model: "City (benzin)", fuel: "benzin", cons: 6.0 },
    { model: "Civic (benzin)", fuel: "benzin", cons: 6.5 },
    { model: "CR-V (benzin)", fuel: "benzin", cons: 7.6 },
  ],
  "Hyundai": [
    { model: "i10 (benzin)", fuel: "benzin", cons: 5.4 },
    { model: "i20 (benzin)", fuel: "benzin", cons: 5.8 },
    { model: "Elantra (benzin)", fuel: "benzin", cons: 6.6 },
    { model: "Bayon (benzin)", fuel: "benzin", cons: 6.0 },
    { model: "Tucson (dizel)", fuel: "dizel", cons: 5.6 },
  ],
  "Opel": [
    { model: "Corsa (benzin)", fuel: "benzin", cons: 5.7 },
    { model: "Astra (benzin)", fuel: "benzin", cons: 6.2 },
    { model: "Astra (dizel)", fuel: "dizel", cons: 4.5 },
    { model: "Grandland (dizel)", fuel: "dizel", cons: 5.6 },
  ],
  "Peugeot": [
    { model: "208 (benzin)", fuel: "benzin", cons: 5.6 },
    { model: "301 (dizel)", fuel: "dizel", cons: 4.5 },
    { model: "308 (benzin)", fuel: "benzin", cons: 6.2 },
    { model: "3008 (dizel)", fuel: "dizel", cons: 5.5 },
  ],
  "Dacia": [
    { model: "Sandero (benzin)", fuel: "benzin", cons: 5.9 },
    { model: "Sandero (LPG)", fuel: "lpg", cons: 7.5 },
    { model: "Duster (dizel)", fuel: "dizel", cons: 5.3 },
    { model: "Duster (LPG)", fuel: "lpg", cons: 8.8 },
  ],
  "Skoda": [
    { model: "Fabia (benzin)", fuel: "benzin", cons: 5.6 },
    { model: "Octavia (benzin)", fuel: "benzin", cons: 6.0 },
    { model: "Octavia (dizel)", fuel: "dizel", cons: 4.6 },
    { model: "Superb (dizel)", fuel: "dizel", cons: 5.0 },
  ],
  "Mercedes-Benz": [
    { model: "A 180 (benzin)", fuel: "benzin", cons: 6.4 },
    { model: "C 200 (benzin)", fuel: "benzin", cons: 6.8 },
    { model: "E 220 d (dizel)", fuel: "dizel", cons: 5.2 },
  ],
  "BMW": [
    { model: "1.16 (benzin)", fuel: "benzin", cons: 6.2 },
    { model: "320i (benzin)", fuel: "benzin", cons: 6.6 },
    { model: "320d (dizel)", fuel: "dizel", cons: 4.8 },
  ],
  "Audi": [
    { model: "A3 (benzin)", fuel: "benzin", cons: 6.2 },
    { model: "A4 (dizel)", fuel: "dizel", cons: 4.9 },
  ],
  "Nissan": [
    { model: "Juke (benzin)", fuel: "benzin", cons: 6.3 },
    { model: "Qashqai (benzin)", fuel: "benzin", cons: 6.6 },
  ],
  "Kia": [
    { model: "Ceed (benzin)", fuel: "benzin", cons: 6.2 },
    { model: "Sportage (dizel)", fuel: "dizel", cons: 5.6 },
  ],
  "Seat": [
    { model: "Ibiza (benzin)", fuel: "benzin", cons: 5.7 },
    { model: "Leon (benzin)", fuel: "benzin", cons: 6.2 },
  ],
  "Elektrikli": [
    { model: "Togg T10X", fuel: "elektrik", cons: 16 },
    { model: "Tesla Model 3", fuel: "elektrik", cons: 15 },
    { model: "Tesla Model Y", fuel: "elektrik", cons: 16.5 },
    { model: "Renault Megane E-Tech", fuel: "elektrik", cons: 16 },
    { model: "Hyundai Kona Electric", fuel: "elektrik", cons: 15.5 },
  ],
};
