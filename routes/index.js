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
    });
    return res.data?.data || {};
  } catch (err) {
    try {
      const fallback = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn },
        headers: AUTH_HEADER,
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
      });

      const pageData = res.data?.data?.datas || [];
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
      ((parseFloat(data.ipva) || 0) +
        (parseFloat(data.ipvb) || 0) +
        (parseFloat(data.ipvc) || 0));

    return res.json({
      pvPower: parseFloat(data.ppv1 || data.ppv) || 0,
      pvVoltage: parseFloat(data.vpv || 0),
      pvCurrent: current || 0,
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
  // accept startDate/endDate from query or body; also accept ISO / YYYY-MM-DD
  let startDate = getParam(req, "startDate");
  let endDate = getParam(req, "endDate");

  // If dates are not provided, default to today (or choose behavior you prefer)
  // Here we error if missing, keeping original behavior, but now deviceSn fallback exists
  if (!deviceSn || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required parameters (deviceSn, startDate, endDate)" });
  }

  // normalize dates (optionally)
  try {
    // try to format to YYYY-MM-DD if possible
    startDate = dayjs(startDate).format("YYYY-MM-DD");
    endDate = dayjs(endDate).format("YYYY-MM-DD");
  } catch (e) {
    // ignore formatting error and pass raw values to API
  }

  try {
    const rawData = await fetchHpsHistory(
      deviceSn,
      startDate,
      endDate,
      type === "string"
    );

    const transformed = rawData.map((item) => ({
      ...item,
      time: item.time,
      pvPower: parseFloat(item.ppv1 || item.ppv || 0),
      pvVoltage: parseFloat(item.vpv || 0),
      pvCurrent: parseFloat(item.ipv || 0),
      pvEnergy: parseFloat(item.epvToday || 0),
      batCharge: parseFloat(item.echargeToday || 0),
      batDischarge: parseFloat(item.edischargeToday || 0),
      gridImport: parseFloat(item.egridToday || 0),
      gridExport: parseFloat(item.etoGridToday || 0),
      loadEnergy: parseFloat(item.eloadToday || 0),
      outputFreq: parseFloat(item.fac || 0),
    }));

    if (transformed.length === 0) {
      return res.status(204).json({ message: "No data available in this time range" });
    }

    return res.json({ data: transformed });
  } catch (err) {
    log("❌ Failed to transform history:", err && err.message);
    return res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

module.exports = router;
