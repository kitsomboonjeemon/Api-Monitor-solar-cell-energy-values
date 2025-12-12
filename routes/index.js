// routes/index.js
const express = require("express");
const axios = require("axios");
const dayjs = require("dayjs");
const router = express.Router();

// ---------------- CONFIG ----------------
const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};

const log = (...args) =>
  console.log(`[${new Date().toISOString()}]`, ...args);

// -------------- HELPERS ----------------
const normalizeTime = (t) => {
  if (!t) return Date.now();
  const n = Number(t);
  if (Number.isFinite(n)) {
    if (n < 1e12) return n * 1000; // sec → ms
    return n;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ---------------- REALTIME FETCH ----------------
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
      const fb = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn },
        headers: AUTH_HEADER,
        timeout: 10000,
      });
      return fb.data?.data || {};
    } catch (err) {
      log("❌ REALTIME fetch failed:", err.message);
      return {};
    }
  }
};

// ---------------- HISTORY FETCH ----------------
const extractPageDataFlexible = (res) => {
  if (!res?.data) return [];
  const d = res.data;
  if (Array.isArray(d.datas)) return d.datas;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.list)) return d.list;
  if (Array.isArray(d.items)) return d.items;

  // Single object
  if (
    typeof d === "object" &&
    (d.time || d.ppv || d.vpv || d.epv)
  )
    return [d];

  return [];
};

const fetchHpsHistory = async (deviceSn, start, end, isStringType) => {
  const endpoint = isStringType ? "hps/data-list-small" : "hps/data-list";
  const all = [];
  let pageNo = 1;
  const pageSize = 2000;

  try {
    while (true) {
      const res = await axios.get(`${BASE_URL}/${endpoint}`, {
        params: { deviceSn, startDate: start, endDate: end, pageNo, pageSize },
        headers: AUTH_HEADER,
        timeout: 20000,
      });

      const page = extractPageDataFlexible(res);

      if (page.length === 0) break;

      all.push(...page);

      if (page.length < pageSize) break;

      pageNo++;
    }
  } catch (err) {
    log("❌ HISTORY fetch failed:", err.message);
  }

  return all;
};

// ----------- Unified realtime API ---------------
router.all("/hps", async (req, res) => {
  const deviceSn = req.query.deviceSn || "YKD0F1022A";

  try {
    const d = await fetchHpsData(deviceSn);

    const pvCurrent =
      num(d.ipv) ||
      num(d.ipva) + num(d.ipvb) + num(d.ipvc);

    return res.json({
      pvPower: num(d.ppv1 || d.ppv),
      pvVoltage: num(d.vpv),
      pvCurrent,
      pvEnergy: num(d.epvToday || d.epv),
      time: normalizeTime(d.time),
    });
  } catch (err) {
    return res.status(500).json({ error: "Realtime fetch failed" });
  }
});

// -------------- HISTORY API ----------------
router.all("/hps/history", async (req, res) => {
  const deviceSn = req.query.deviceSn || "YKD0F1022A";

  let start = req.query.startDate;
  let end = req.query.endDate;
  const type = req.query.type || "central";

  if (!start || !end)
    return res.status(400).json({
      error: "Missing startDate or endDate",
    });

  start = dayjs(start).format("YYYY-MM-DD");
  end = dayjs(end).format("YYYY-MM-DD");

  const raw = await fetchHpsHistory(deviceSn, start, end, type === "string");

  if (!raw || raw.length === 0) {
    const rt = await fetchHpsData(deviceSn);
    return res.json({
      data: [
        {
          time: normalizeTime(rt.time),
          pvPower: num(rt.ppv1 || rt.ppv),
          pvVoltage: num(rt.vpv),
          pvCurrent:
            num(rt.ipv) +
            num(rt.ipva) +
            num(rt.ipvb) +
            num(rt.ipvc),
        },
      ],
    });
  }

  const mapped = raw.map((d) => ({
    time: normalizeTime(
      d.time ||
        d.datetime ||
        d.recordTime ||
        d.ts ||
        d.date
    ),
    pvPower: num(d.ppv1 || d.ppv),
    pvVoltage: num(d.vpv),
    pvCurrent:
      num(d.ipv) ||
      num(d.ipva) + num(d.ipvb) + num(d.ipvc),
  }));

  return res.json({ data: mapped });
});

module.exports = router;
