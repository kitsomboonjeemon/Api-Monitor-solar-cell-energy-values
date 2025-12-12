const express = require("express");
const axios = require("axios");
const dayjs = require("dayjs");

const router = express.Router();

const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};

const log = (...args) => {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
};

const fetchHpsData = async (deviceSn) => {
  try {
    const res = await axios.get(`${BASE_URL}/hps/data-last`, {
      params: { deviceSn },
      headers: AUTH_HEADER,
      timeout: 10000,
    });
    return res.data?.data || {};
  } catch (err) {
    try {
      const fallback = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn },
        headers: AUTH_HEADER,
        timeout: 10000,
      });
      return fallback.data?.data || {};
    } catch (error) {
      log("❌ Failed to fetch HPS realtime data:", error && error.message);
      return {};
    }
  }
};

const fetchHpsHistory = async (deviceSn, startDate, endDate, isStringType) => {
  try {
    const endpoint = isStringType ? "hps/data-list-small" : "hps/data-list";
    const allData = [];
    let pageNo = 1;
    const pageSize = 2000;

    while (true) {
      const res = await axios.get(`${BASE_URL}/${endpoint}`, {
        params: { deviceSn, startDate, endDate, pageNo, pageSize },
        headers: AUTH_HEADER,
        timeout: 20000,
      });

      // Atess sometimes returns data.datas or data (array). Be flexible.
      const pageData = res.data?.data?.datas || res.data?.data || [];
      if (!Array.isArray(pageData)) break;
      allData.push(...pageData);
      if (pageData.length < pageSize) break;
      pageNo++;
    }

    return allData;
  } catch (err) {
    log("❌ Failed to fetch HPS history:", err && err.message);
    return [];
  }
};

// Helper: get deviceSn from query, body or env fallback
function getDeviceSnFromReq(req) {
  return (
    (req.query && req.query.deviceSn) ||
    (req.body && req.body.deviceSn) ||
    process.env.DEFAULT_DEVICE_SN ||
    "YKD0F1022A"
  );
}

// Helper: get param from query or body
function getParam(req, name, defaultValue = undefined) {
  if (req.query && typeof req.query[name] !== "undefined") return req.query[name];
  if (req.body && typeof req.body[name] !== "undefined") return req.body[name];
  return defaultValue;
}

// Allow both GET and POST for realtime hps
router.all("/hps", async (req, res) => {
  const deviceSn = getDeviceSnFromReq(req);

  if (!deviceSn) {
    return res.status(400).json({ error: "Missing deviceSn" });
  }

  try {
    const data = await fetchHpsData(deviceSn);

    const current =
      parseFloat(data.ipv) ||
      ((parseFloat(data.ipva) || 0) + (parseFloat(data.ipvb) || 0) + (parseFloat(data.ipvc) || 0));

    return res.json({
      pvPower: parseFloat(data.ppv1 || data.ppv || 0) || 0,
      pvVoltage: parseFloat(data.vpv || 0),
      pvCurrent: current || 0,
      pvEnergy: parseFloat(data.epv || data.epvToday || 0),
      // include raw payload if useful
      _raw: data,
    });
  } catch (err) {
    log("❌ /hps handler error:", err && err.message);
    return res.status(500).json({ error: "Failed to fetch hps data" });
  }
});

// Allow both GET and POST for history
router.all("/hps/history", async (req, res) => {
  const deviceSn = getDeviceSnFromReq(req);
  const type = getParam(req, "type", "central");
  let startDate = getParam(req, "startDate");
  let endDate = getParam(req, "endDate");

  if (!deviceSn || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required parameters (deviceSn, startDate, endDate)" });
  }

  try {
    startDate = dayjs(startDate).format("YYYY-MM-DD");
    endDate = dayjs(endDate).format("YYYY-MM-DD");
  } catch (e) {}

  try {
    const rawData = await fetchHpsHistory(deviceSn, startDate, endDate, type === "string");

    const transformed = rawData.map((item) => {
      const time = item.time || item.datetime || item.recordTime || item.ts || null;

      const pvPower = parseFloat(item.ppv1 || item.ppv || 0) || 0;
      const pvVoltage = parseFloat(item.vpv || 0) || 0;

      const pvCurrent =
        parseFloat(item.ipv || 0) ||
        ((parseFloat(item.ipva || 0) || 0) + (parseFloat(item.ipvb || 0) || 0) + (parseFloat(item.ipvc || 0) || 0)) ||
        0;

      const pvEnergy = parseFloat(item.epv || item.epvTotal || item.epvToday || 0) || 0;

      return {
        ...item,
        time,
        pvPower,
        pvVoltage,
        pvCurrent,
        pvEnergy,
        batCharge: parseFloat(item.echarge || item.echargeToday || 0) || 0,
        batDischarge: parseFloat(item.edischarge || item.edischargeToday || 0) || 0,
        gridImport: parseFloat(item.egrid || item.egridToday || 0) || 0,
        gridExport: parseFloat(item.etoGrid || item.etoGridToday || 0) || 0,
        loadEnergy: parseFloat(item.eload || item.eloadToday || 0) || 0,
        outputFreq: parseFloat(item.fac || 0) || 0,
      };
    });

    // Return array directly. If empty -> return [] (status 200)
    if (!Array.isArray(transformed) || transformed.length === 0) {
      return res.json([]);
    }

    return res.json(transformed);
  } catch (err) {
    log("❌ Failed to transform history:", err && err.message);
    return res.status(500).json({ error: "Failed to fetch historical data" });
  }
});
// Allow both GET and POST for history
router.all("/hps/history", async (req, res) => {
  const deviceSn = getDeviceSnFromReq(req);
  const type = getParam(req, "type", "central");
  let startDate = getParam(req, "startDate");
  let endDate = getParam(req, "endDate");

  if (!deviceSn || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required parameters (deviceSn, startDate, endDate)" });
  }

  try {
    startDate = dayjs(startDate).format("YYYY-MM-DD");
    endDate = dayjs(endDate).format("YYYY-MM-DD");
  } catch (e) {}

  try {
    const rawData = await fetchHpsHistory(deviceSn, startDate, endDate, type === "string");

    const transformed = rawData.map((item) => {
      const time = item.time || item.datetime || item.recordTime || item.ts || null;

      const pvPower = parseFloat(item.ppv1 || item.ppv || 0) || 0;
      const pvVoltage = parseFloat(item.vpv || 0) || 0;

      const pvCurrent =
        parseFloat(item.ipv || 0) ||
        ((parseFloat(item.ipva || 0) || 0) + (parseFloat(item.ipvb || 0) || 0) + (parseFloat(item.ipvc || 0) || 0)) ||
        0;

      const pvEnergy = parseFloat(item.epv || item.epvTotal || item.epvToday || 0) || 0;

      return {
        ...item,
        time,
        pvPower,
        pvVoltage,
        pvCurrent,
        pvEnergy,
        batCharge: parseFloat(item.echarge || item.echargeToday || 0) || 0,
        batDischarge: parseFloat(item.edischarge || item.edischargeToday || 0) || 0,
        gridImport: parseFloat(item.egrid || item.egridToday || 0) || 0,
        gridExport: parseFloat(item.etoGrid || item.etoGridToday || 0) || 0,
        loadEnergy: parseFloat(item.eload || item.eloadToday || 0) || 0,
        outputFreq: parseFloat(item.fac || 0) || 0,
      };
    });

    // Return array directly. If empty -> return [] (status 200)
    if (!Array.isArray(transformed) || transformed.length === 0) {
      return res.json([]);
    }

    return res.json(transformed);
  } catch (err) {
    log("❌ Failed to transform history:", err && err.message);
    return res.status(500).json({ error: "Failed to fetch historical data" });
  }
});


module.exports = router;
