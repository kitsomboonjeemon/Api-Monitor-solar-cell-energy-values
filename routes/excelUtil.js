const express = require("express");
const axios = require("axios");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const app = express();
const PORT = 3001;

// ========== CONFIG ==========
const DEVICE_SN = "YKD0F1022A";
const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};
const OUTPUT_DIR = "D:/BNsolarpower/download";
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

    const pvPower = safeParse(data?.ppv1);
    const pvEnergy = safeParse(data?.epvToday);
    const irradiance = estimateIrradiance(pvPower);
    const pvCurrent =
      safeParse(data?.ipv) ||
      safeParse(data?.ipva) + safeParse(data?.ipvb) + safeParse(data?.ipvc);

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
      batCharge: safeParse(data?.echargeToday),
      batDischarge: safeParse(data?.edischargeToday),
      gridImport: safeParse(data?.egridToday),
      gridExport: safeParse(data?.etoGridToday),
      loadEnergy: safeParse(data?.eloadToday),
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

// // ========== SAVE TO EXCEL ==========
// const saveToExcel = async (data) => {
//   if (!data) return;
//   const now = new Date();
//   const timestamp = data.timestamp || now.toISOString();
//   const fileName = `data_monitoring_${timestamp
//     .replace(/:/g, "-")
//     .slice(0, 16)}.xlsx`;
//   const exportPath = path.join(OUTPUT_DIR, fileName);
//   const historyPath = path.join(OUTPUT_DIR, "data_history.xlsx");

//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet("Data");

//   worksheet.columns = [
//     { header: "Timestamp", key: "timestamp", width: 25 },
//     { header: "PV Power (kW)", key: "pvPower", width: 15 },
//     { header: "PV Voltage (V)", key: "pvVoltage", width: 15 },
//     { header: "PV Current total (A)", key: "pvCurrent", width: 20 },
//     { header: "PV Current (A)", key: "pvCurrent1", width: 15 },
//     { header: "PV Energy (kWh)", key: "pvEnergy", width: 15 },
//     { header: "Battery Charge (kWh)", key: "batCharge", width: 20 },
//     { header: "Battery Discharge (kWh)", key: "batDischarge", width: 20 },
//     { header: "Grid Import (kWh)", key: "gridImport", width: 18 },
//     { header: "Grid Export (kWh)", key: "gridExport", width: 18 },
//     { header: "Load Energy (kWh)", key: "loadEnergy", width: 18 },
//     { header: "Output Frequency (Hz)", key: "outputFreq", width: 20 },
//     { header: "CO₂ Reduced (kgCO₂)", key: "co2Reduced", width: 18 },
//     { header: "Oil Equivalent (ktoe)", key: "ktoe", width: 20 },
//     { header: "Irradiance (W/m²)", key: "irradiance", width: 20 },
//     { header: "Backplane Temp (°C)", key: "backplaneTemp", width: 20 },
//   ];

//   const rows = [];
//   if (fs.existsSync(historyPath)) {
//     const oldBook = new ExcelJS.Workbook();
//     await oldBook.xlsx.readFile(historyPath);
//     const oldSheet = oldBook.getWorksheet("Data");
//     if (oldSheet) {
//       oldSheet.eachRow((row, rowNumber) => {
//         if (rowNumber !== 1) {
//           const [
//             timestamp,
//             pvPower,
//             pvVoltage,
//             pvCurrent,
//             pvCurrent1,
//             pvEnergy,
//             batCharge,
//             batDischarge,
//             gridImport,
//             gridExport,
//             loadEnergy,
//             outputFreq,
//             co2Reduced,
//             ktoe,
//             irradiance,
//             backplaneTemp,
//           ] = row.values.slice(1);
//           rows.push({
//             timestamp,
//             pvPower,
//             pvVoltage,
//             pvCurrent,
//             pvCurrent1,
//             pvEnergy,
//             batCharge,
//             batDischarge,
//             gridImport,
//             gridExport,
//             loadEnergy,
//             outputFreq,
//             co2Reduced,
//             ktoe,
//             irradiance,
//             backplaneTemp,
//           });
//         }
//       });
//     }
//   }

//   if (rows.some((r) => r.timestamp === data.timestamp)) {
//     log("⚠️ Duplicate timestamp. Skipped:", data.timestamp);
//     return;
//   }

//   worksheet.addRow(data);
//   rows.forEach((r) => worksheet.addRow(r));
//   await workbook.xlsx.writeFile(exportPath);
//   await workbook.xlsx.writeFile(historyPath);
//   log("✅ Data saved:", exportPath);
// };

// ========== EXPORT ==========
module.exports = {
  fetchRealtimeData,
  // saveToExcel,
};
