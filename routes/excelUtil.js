const axios = require("axios");
const fetch = require("node-fetch");

// ========== CONFIG ==========
const DEVICE_SN = process.env.DEFAULT_DEVICE_SN || "YKD0F1022A";
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
  return isNaN(parsed) ? 0 : parsed;
};

const estimateIrradiance = (
  pvPowerKw,
  totalArea = 50 * 2.85,
  efficiency = 0.2
) => {
  const pvPowerW = pvPowerKw * 1000;
  const irradiance = pvPowerW / (totalArea * efficiency);
  return parseFloat(irradiance.toFixed(2));
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
    let res, data, msg;

    try {
      res = await axios.get(`${BASE_URL}/hps/data-last`, {
        params: { deviceSn: DEVICE_SN },
        headers: AUTH_HEADER,
      });
      ({ data, msg } = res.data || {});
      log("✅ Atess Primary Response:", res.data);
    } catch (err) {
      const fallback = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn: DEVICE_SN },
        headers: AUTH_HEADER,
      });
      data = fallback.data?.data;
      log("🔁 Atess Fallback Response:", fallback.data);
    }

    if (!data || typeof data !== "object") {
      log("⚠️ Atess no usable data. Returning default.");
      const now = new Date().toISOString();
      return {
        timestamp: now,
        pvPower: 0,
        pvVoltage: 0,
        pvCurrent: 0,
        pvCurrent1: 0,
        pvEnergy: 0,
        batCharge: 0,
        batDischarge: 0,
        gridImport: 0,
        gridExport: 0,
        loadEnergy: 0,
        outputFreq: 0,
        co2Reduced: 0,
        ktoe: 0,
        irradiance: 0,
        backplaneTemp: null,
      };
    }

    // อ่านค่า pvPower รองรับทั้ง ppv1 และ ppv
    const pvPower = safeParse(data?.ppv1 || data?.ppv || 0);

    // pvEnergy: prefer per-record epv if provided, otherwise fallback to epvToday
    const pvEnergy = safeParse(data?.epv || data?.epvToday || 0);

    const irradiance = estimateIrradiance(pvPower);

    // pvCurrent: ใช้ ipv ถ้ามี ถ้าไม่มีรวม ipva/ipvb/ipvc
    const pvCurrent =
      safeParse(data?.ipv) ||
      (safeParse(data?.ipva) + safeParse(data?.ipvb) + safeParse(data?.ipvc));

    const weather = await fetchWeather();
    const backplaneTemp =
      weather.ambientTemp !== null
        ? Math.min(weather.ambientTemp + pvPower * 3, 80)
        : null;

    return {
      timestamp: data?.time || new Date().toISOString(),
      pvPower,
      pvVoltage: safeParse(data?.vpv),
      pvCurrent,
      pvCurrent1: safeParse(data?.ipv),
      pvEnergy,
      batCharge: safeParse(data?.echargeToday || data?.echarge || 0),
      batDischarge: safeParse(data?.edischargeToday || data?.edischarge || 0),
      gridImport: safeParse(data?.egridToday || data?.egrid || 0),
      gridExport: safeParse(data?.etoGridToday || data?.etoGrid || 0),
      loadEnergy: safeParse(data?.eloadToday || data?.eload || 0),
      outputFreq: safeParse(data?.fac),
      co2Reduced: pvEnergy * 0.9,
      ktoe: pvEnergy / 11630,
      irradiance,
      backplaneTemp,
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
