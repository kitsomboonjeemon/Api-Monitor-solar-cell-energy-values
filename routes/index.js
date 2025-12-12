// routes/index.js
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

// ------------------------- REALTIME -------------------------
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
      log("❌ Failed to fetch HPS realtime:", error.message);
      return {};
    }
  }
};

// ------------------------- HISTORY -------------------------
const extractPageDataFlexible = (res) => {
  if (!res || typeof res !== "object") return [];

  const d = res.data;
  if (Array.isArray(d?.datas)) return d.datas;
  if (Array.isArray(d)) return d;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(d?.list)) return d.list;
  if (Array.isArray(d?.items)) return d.items;

  // single record?
  if (d && typeof d === "object" && !Array.isArray(d)) {
    if (d.time || d.ppv || d.vpv || d.epv) return d;
  }

  return [];
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

      const pageData = extractPageDataFlexible(res);

      if (Array.isArray(pageData)) {
        allData.push(...pageData);
        if (pageData.length < pageSize) break;
        pageNo++;
        continue;
      }

      if (pageData && typeof pageData === "object") {
        allData.push(pageData);
        break;
      }

      break;
    }

    return allData;
  } catch (err) {
    log("❌ Failed to fetch history:", err.message);
    return [];
  }
};

// ------------------------- HELPERS -------------------------
function getDeviceSnFromReq(req) {
  return (
    req.query?.deviceSn ||
    req.body?.deviceSn ||
    process.env.DEFAULT_DEVICE_SN ||
    "YKD0F1022A"
  );
}

function getParam(req, name, defaultValue) {
  if (req.query?.[name] !== undefined) return req.query[name];
  if (req.body?.[name] !== undefined) return req.body[name];
  return defaultValue;
}

// ------------------------- REALTIME API -------------------------
router.all("/hps", async (req, res) => {
  const deviceSn = getDeviceSnFromReq(req);
  if (!deviceSn) return res.status(400).json({ error: "Missing deviceSn" });

  try {
    const data = await fetchHpsData(deviceSn);

    const current =
      parseFloat(data.ipv) ||
      (parseFloat(data.ipva || 0) +
        parseFloat(data.ipvb || 0) +
        parseFloat(data.ipvc || 0));

    return res.json({
      pvPower: parseFloat(data.ppv1 || data.ppv || 0) || 0,
      pvVoltage: parseFloat(data.vpv || 0),
      pvCurrent: current || 0,
      pvEnergy: parseFloat(data.epv || data.epvToday || 0),
      _raw: data,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch realtime" });
  }
});

// ------------------------- HISTORY API -------------------------
router.all("/hps/history", async (req, res) => {
  log("📥 /hps/history request", req.query);

  const deviceSn = getDeviceSnFromReq(req);
  const type = getParam(req, "type", "central");

  let startDate = getParam(req, "startDate");
  let endDate = getParam(req, "endDate");

  if (!deviceSn || !startDate || !endDate) {
    return res.status(400).json({
      error: "Missing required parameters (deviceSn,startDate,endDate)",
    });
  }

  // normalize date format
  startDate = dayjs(startDate).format("YYYY-MM-DD");
  endDate = dayjs(endDate).format("YYYY-MM-DD");

  // fetch history
  const rawData = await fetchHpsHistory(deviceSn, startDate, endDate, type === "string");

  // ------------------------- FALLBACK AUTO -------------------------
  if (!rawData || rawData.length === 0) {
    log("⚠️ No history found → using realtime fallback");

    const now = await fetchHpsData(deviceSn);

    if (now && Object.keys(now).length > 0) {
      return res.json({
        data: [
          {
            time: now.time || new Date().toISOString(),
            pvPower: parseFloat(now.ppv1 || now.ppv || 0),
            pvVoltage: parseFloat(now.vpv || 0),
            pvCurrent:
              parseFloat(now.ipv || 0) +
              parseFloat(now.ipva || 0) +
              parseFloat(now.ipvb || 0) +
              parseFloat(now.ipvc || 0),
            pvEnergy: parseFloat(now.epvToday || now.epv || 0),
          },
        ],
      });
    }

    return res.json({ data: [] });
  }

  // ------------------------- TRANSFORM DATA -------------------------
  const transformed = rawData.map((item) => {
    let time =
      item.time ||
      item.datetime ||
      item.recordTime ||
      item.ts ||
      item.date ||
      null;

    const pvPower = parseFloat(item.ppv1 || item.ppv || 0) || 0;
    const pvVoltage = parseFloat(item.vpv || 0) || 0;

    const pvCurrent =
      parseFloat(item.ipv || 0) ||
      (parseFloat(item.ipva || 0) +
        parseFloat(item.ipvb || 0) +
        parseFloat(item.ipvc || 0));

    return {
      ...item,
      time,
      pvPower,
      pvVoltage,
      pvCurrent,
    };
  });

  return res.json({ data: transformed });
});

module.exports = router;
