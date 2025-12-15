const axios = require("axios");
const fetch = require("node-fetch");

// ========== CONFIG ==========
const DEVICE_SN = "YKD0F1022A";
const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
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
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : 0;
};

const estimateIrradiance = (
  pvPowerKw,
  totalArea = 50 * 2.85,
  efficiency = 0.2
) => {
  if (!pvPowerKw) return 0;
  return parseFloat(
    ((pvPowerKw * 1000) / (totalArea * efficiency)).toFixed(2)
  );
};

const fetchWeather = async () => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();

    return {
      ambientTemp: data.main?.temp ?? null,
      humidity: data.main?.humidity ?? null,
      windSpeed: data.wind?.speed ?? null,
    };
  } catch (err) {
    log("❌ Weather API failed:", err.message);
    return {
      ambientTemp: null,
      humidity: null,
      windSpeed: null,
    };
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
      });
      data = res.data?.data;
    } catch {
      const fallback = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn: DEVICE_SN },
        headers: AUTH_HEADER,
      });
      data = fallback.data?.data;
    }

    if (!data) return null;

    // ===== 🔴 FIX จุดสำคัญ =====
    const pvPower = safeParse(data.ppv);          // ✅ FIX (เดิม ppv1)
    const pvEnergy = safeParse(data.ePvToday);    // ✅ FIX (เดิม epvToday)

    const weather = await fetchWeather();

    return {
      timestamp: data.time || new Date().toISOString(),

      pvPower,
      pvVoltage: safeParse(data.vpv),
      pvCurrent:
        safeParse(data.ipv) ||
        safeParse(data.ipva) +
          safeParse(data.ipvb) +
          safeParse(data.ipvc),

      pvEnergy,

      // ===== 🔴 FIX field energy =====
      batCharge: safeParse(data.eBatChargeToday),       // ✅ FIX
      batDischarge: safeParse(data.eBatDischargeToday), // ✅ FIX

      gridImport: safeParse(data.eGridInToday),         // ✅ FIX
      gridExport: safeParse(data.eGridOutToday),        // ✅ FIX

      loadEnergy: safeParse(data.eLoadToday),           // ✅ FIX

      outputFreq: safeParse(data.outFreq),              // ✅ FIX (เดิม fac)

      co2Reduced: pvEnergy * 0.9,
      ktoe: pvEnergy / 11630,

      irradiance: estimateIrradiance(pvPower),

      backplaneTemp:
        weather.ambientTemp !== null
          ? Math.min(weather.ambientTemp + pvPower * 3, 80)
          : null,
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
