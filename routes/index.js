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
  if (typeof t === "number") return t < 1e12 ? t * 1000 : t;
  const d = dayjs(t.replace(" ", "T"));
  return d.isValid() ? d.valueOf() : null;
};

const getDeviceSn = (req) =>
  req.query?.deviceSn ||
  req.body?.deviceSn ||
  process.env.DEFAULT_DEVICE_SN ||
  "YKD0F1022A";

// ===================== REALTIME =====================
router.get("/hps", async (req, res) => {
  const deviceSn = getDeviceSn(req);

  try {
    const r = await axios.get(`${BASE_URL}/hps/data-last`, {
      params: { deviceSn },
      headers: AUTH_HEADER,
      timeout: 10000,
    });

    const d = r.data?.data || {};

    res.json({
      pvPower: toNumber(d.ppv1 || d.ppv),
      pvVoltage: toNumber(d.vpv),
      pvCurrent:
        toNumber(d.ipv) ||
        toNumber(d.ipva) + toNumber(d.ipvb) + toNumber(d.ipvc),
      time: d.time || new Date().toISOString(),
    });
  } catch (err) {
    log("❌ realtime error:", err.message);
    res.json({});
  }
});

// ===================== HISTORY (PV GRAPH) =====================
const fetchPvHistory = async (deviceSn, startDate, endDate) => {
  try {
    const res = await axios.get(`${BASE_URL}/hps/data-chart`, {
      params: {
        deviceSn,
        startDate,
        endDate,
        type: "pv",        // ⭐ PV time-series
        timeType: "hour",  // หรือ "minute"
      },
      headers: AUTH_HEADER,
      timeout: 20000,
    });

    return res.data?.data || [];
  } catch (err) {
    log("❌ data-chart error:", err.message);
    return [];
  }
};

// ===================== HISTORY ROUTE =====================
router.get("/hps/history", async (req, res) => {
  const deviceSn = getDeviceSn(req);
  const { startDate, endDate } = req.query;

  if (!deviceSn || !startDate || !endDate) {
    return res.status(400).json({
      error: "Missing deviceSn / startDate / endDate",
    });
  }

  const raw = await fetchPvHistory(
    deviceSn,
    dayjs(startDate).format("YYYY-MM-DD"),
    dayjs(endDate).format("YYYY-MM-DD")
  );

  const transformed = raw
    .map((item) => {
      const time = toTime(item.time || item.collectTime);
      if (!time) return null;

      return {
        time,
        pvPower: toNumber(item.power),
        pvVoltage: toNumber(item.voltage),
        pvCurrent: toNumber(item.current),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  res.json({ data: transformed });
});

module.exports = router;
