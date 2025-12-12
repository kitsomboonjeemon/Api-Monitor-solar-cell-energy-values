const express = require("express");
const axios = require("axios");
const dayjs = require("dayjs");

const router = express.Router();

const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};

// ===================== UTIL =====================
const log = (...args) => {
  console.log(`[${new Date().toISOString()}]`, ...args);
};

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toTime = (t) => {
  if (!t) return null;

  // number (sec / ms)
  if (typeof t === "number") {
    return t < 1e12 ? t * 1000 : t;
  }

  // string
  const d = dayjs(t.replace(" ", "T"));
  return d.isValid() ? d.valueOf() : null;
};

// ⭐ deviceSn helper (สำคัญมาก)
const getDeviceSn = (req) => {
  return (
    req.query?.deviceSn ||
    req.body?.deviceSn ||
    process.env.DEFAULT_DEVICE_SN ||
    "YKD0F1022A"
  );
};

// ===================== REALTIME =====================
const fetchHpsData = async (deviceSn) => {
  try {
    const res = await axios.get(`${BASE_URL}/hps/data-last`, {
      params: { deviceSn },
      headers: AUTH_HEADER,
      timeout: 10000,
    });
    return res.data?.data || {};
  } catch {
    try {
      const res = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn },
        headers: AUTH_HEADER,
        timeout: 10000,
      });
      return res.data?.data || {};
    } catch (err) {
      log("❌ realtime error:", err.message);
      return {};
    }
  }
};

// ===================== HISTORY =====================
const fetchHpsHistory = async (deviceSn, startDate, endDate, isStringType) => {
  const endpoint = isStringType ? "hps/data-list-small" : "hps/data-list";
  const pageSize = 2000;
  let pageNo = 1;
  const all = [];

  try {
    while (true) {
      const res = await axios.get(`${BASE_URL}/${endpoint}`, {
        params: { deviceSn, startDate, endDate, pageNo, pageSize },
        headers: AUTH_HEADER,
        timeout: 20000,
      });

      const rows = res.data?.data?.datas || [];
      all.push(...rows);

      if (rows.length < pageSize) break;
      pageNo++;
    }
    return all;
  } catch (err) {
    log("❌ history error:", err.message);
    return [];
  }
};

// ===================== ROUTES =====================

// ---------- REALTIME ----------
router.get("/hps", async (req, res) => {
  const deviceSn = getDeviceSn(req);
  if (!deviceSn) {
    return res.status(400).json({ error: "Missing deviceSn" });
  }

  const d = await fetchHpsData(deviceSn);

  const pvCurrent =
    toNumber(d.ipv) ||
    toNumber(d.ipva) + toNumber(d.ipvb) + toNumber(d.ipvc);

  res.json({
    pvPower: toNumber(d.ppv1 || d.ppv),
    pvVoltage: toNumber(d.vpv),
    pvCurrent,
    time: d.time || new Date().toISOString(),
  });
});

// ---------- HISTORY ----------
router.get("/hps/history", async (req, res) => {
  const deviceSn = getDeviceSn(req);
  const { type = "central", startDate, endDate } = req.query;

  if (!deviceSn || !startDate || !endDate) {
    return res.status(400).json({
      error: "Missing deviceSn / startDate / endDate",
    });
  }

  const raw = await fetchHpsHistory(
    deviceSn,
    dayjs(startDate).format("YYYY-MM-DD"),
    dayjs(endDate).format("YYYY-MM-DD"),
    type === "string"
  );

  const transformed = raw
    .map((item) => {
      const time = toTime(
        item.time ||
          item.recordTime ||
          item.datetime ||
          item.date
      );
      if (!time) return null;

      return {
        time,
        pvPower: toNumber(item.ppv1 || item.ppv),
        pvVoltage: toNumber(item.vpv),
        pvCurrent:
          toNumber(item.ipv) ||
          toNumber(item.ipva) +
            toNumber(item.ipvb) +
            toNumber(item.ipvc),

        // optional (ใช้ต่อได้)
        pvEnergy: toNumber(item.epvToday),
        batCharge: toNumber(item.echargeToday),
        batDischarge: toNumber(item.edischargeToday),
        gridImport: toNumber(item.egridToday),
        gridExport: toNumber(item.etoGridToday),
        loadEnergy: toNumber(item.eloadToday),
        outputFreq: toNumber(item.fac),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  // ⭐ frontend ใช้ res.data.data
  res.json({ data: transformed });
});

module.exports = router;
