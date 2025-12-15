const axios = require("axios");
const fetch = require("node-fetch");

// ========== CONFIG ==========
const DEVICE_SN = "YKD0F1022A";
const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization:
    "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};

const OPENWEATHER_API_KEY = "b44371ad8f911c6a9d7318b6c2a3d9a3";
const LAT = 19.195382;
const LON = 97.988572;

// ========== HELPERS ==========
const log = (...args) => {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
};

const safeParse = (val) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
};

const estimateIrradiance = (
  pvPowerKw,
  totalArea = 50 * 2.85,
  efficiency = 0.2
) => {
  if (!pvPowerKw) return 0;
  return Number(
    ((pvPowerKw * 1000) / (totalArea * efficiency)).toFixed(2)
  );
};

// ========== WEATHER ==========
const fetchWeather = async () => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();

    return {
      ambientTemp: data.main?.temp ?? null,
    };
  } catch (err) {
    log("❌ Weather API failed:", err.message);
    return { ambientTemp: null };
  }
};

// ========== FETCH REALTIME ==========
const fetchRealtimeData = async () => {
  try {
    let data;

    try {
      const res = await axios.get(`${BASE_URL}/hps/data-last`, {
        params: { deviceSn: DEVICE_SN },
        headers: AUTH_HEADER,
        timeout: 10000,
      });
      data = res.data?.data;
    } catch {
      const fallback = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn: DEVICE_SN },
        headers: AUTH_HEADER,
        timeout: 10000,
      });
      data = fallback.data?.data;
    }

    if (!data) {
      log("❌ No Atess data");
      return null;
    }

    // ===== ✅ FIX สำคัญ =====
    const pvPower =
      safeParse(data.ppv) || safeParse(data.ppv1); // รองรับ 2 แบบ
    const pvEnergy =
      safeParse(data.ePvToday) || safeParse(data.epvToday);

    const weather = await fetchWeather();

    return {
      timestamp: data.time || new Date().toISOString(),

      // ===== PV =====
      pvPower,
      pvEnergy,
      pvVoltage: safeParse(data.vpv),
      pvCurrent:
        safeParse(data.ipv) ||
        safeParse(data.ipva) +
          safeParse(data.ipvb) +
          safeParse(data.ipvc),

      // ===== Battery =====
      batCharge:
        safeParse(data.eBatChargeToday) ||
        safeParse(data.echargeToday),

      batDischarge:
        safeParse(data.eBatDischargeToday) ||
        safeParse(data.edischargeToday),

      // ===== Grid =====
      gridImport:
        safeParse(data.eGridInToday) ||
        safeParse(data.egridToday),

      gridExport:
        safeParse(data.eGridOutToday) ||
        safeParse(data.etoGridToday),

      // ===== Load =====
      loadEnergy:
        safeParse(data.eLoadToday) ||
        safeParse(data.eloadToday),

      // ===== Inverter =====
      outputFreq:
        safeParse(data.outFreq) ||
        safeParse(data.fac),

      // ===== Social =====
      co2Reduced: pvEnergy * 0.9,
      ktoe: pvEnergy / 11630,

      irradiance: estimateIrradiance(pvPower),

      backplaneTemp:
        weather.ambientTemp !== null
          ? Math.min(weather.ambientTemp + pvPower * 3, 80)
          : null,

      source: "atess",
    };
  } catch (err) {
    log("❌ fetchRealtimeData error:", err.message);
    return null;
  }
};

// ========== EXPORT ==========
module.exports = {
  fetchRealtimeData,
};
