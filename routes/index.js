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
    const r = await axios.get(`${BASE_URL}/hps/data-last-small`, {
      params: { deviceSn },
      headers: AUTH_HEADER,
      timeout: 10000,
    });

    const d = r.data?.data || {};

    res.json({
      pvPower: toNumber(d.ppv),
      pvVoltage: toNumber(d.vpv),
      pvCurrent: toNumber(d.ipv),
      time: d.recordTime || d.time || new Date().toISOString(),
    });
  } catch (err) {
    log("❌ realtime error:", err.message);
    res.json({});
  }
});


// ===================== HISTORY FETCH (CORRECT) =====================
const fetchPvHistory = async (deviceSn, startDate, endDate) => {
  const pageSize = 200;
  let pageNo = 1;
  const all = [];

  try {
    while (true) {
      const res = await axios.get(`${BASE_URL}/hps/data-list-small`, {
        params: {
          deviceSn,
          startDate,
          endDate,
          pageNo,
          pageSize,
        },
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
    startDate,
    endDate
  );

  const transformed = raw
    .map((item) => {
      const time = toTime(item.recordTime || item.time);
      if (!time) return null;

      return {
        time,
        pvPower: toNumber(item.ppv),
        pvVoltage: toNumber(item.vpv),
        pvCurrent: toNumber(item.ipv),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  res.json({ data: transformed });
});

module.exports = router;
