const express = require("express");
const axios = require("axios");

const router = express.Router();

const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic ",
  "Accept-Language": "en",
};

const log = (...args) => {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
};

// ---------- HELPERS ----------
/**
 * 🔒 Load P (kW) สำหรับเครื่อง Atess รุ่นนี้
 * ใช้ค่า "loadActivePower" โดยตรง (Active Power ของ Load)
 * ไม่ใช้ pac / pout / pload
 */
const calcLoadPower = (item = {}) => {
  let v = Number(item.loadActivePower);

  // กันกรณีค่าไม่ถูกต้อง
  if (!Number.isFinite(v)) v = 0;

  // กันกรณีหน่วยเป็น W → kW (เช่น 3100 → 3.1)
  if (v > 100) v = v / 1000;

  // Load ไม่ควรติดลบ
  if (v < 0) v = 0;

  return v;
};

// ---------- FETCHERS ----------
const fetchHpsData = async (deviceSn) => {
  try {
    const res = await axios.get(`${BASE_URL}/hps/data-last`, {
      params: { deviceSn },
      headers: AUTH_HEADER,
    });
    return res.data?.data || {};
  } catch {
    try {
      const fallback = await axios.get(`${BASE_URL}/hps/data-last-small`, {
        params: { deviceSn },
        headers: AUTH_HEADER,
      });
      return fallback.data?.data || {};
    } catch (error) {
      log("❌ Failed to fetch HPS realtime data:", error.message);
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
    log("❌ Failed to fetch HPS history:", err.message);
    return [];
  }
};

// ---------- ROUTES ----------
router.get("/hps", async (req, res) => {
  const { deviceSn } = req.query;
  if (!deviceSn) return res.status(400).json({ error: "Missing deviceSn" });

  const data = await fetchHpsData(deviceSn);

  const pvCurrent =
    parseFloat(data.ipv) ||
    (parseFloat(data.ipva) || 0) +
      (parseFloat(data.ipvb) || 0) +
      (parseFloat(data.ipvc) || 0);

  // ✅ Load P (kW) ตรงกับ Atess
  const loadPower = calcLoadPower(data);

  res.json({
    pvPower: parseFloat(data.ppv1 || data.ppv) || 0,
    pvVoltage: parseFloat(data.vpv || 0),
    pvCurrent: pvCurrent || 0,
    loadPower,
  });
});

router.get("/hps/history", async (req, res) => {
  const { deviceSn, type = "central", startDate, endDate } = req.query;
  if (!deviceSn || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const rawData = await fetchHpsHistory(
      deviceSn,
      startDate,
      endDate,
      type === "string"
    );

    // 🧪 LOG ตรวจสอบครั้งสุดท้าย (ลบออกได้เมื่อมั่นใจ)
    rawData.slice(0, 3).forEach((item) => {
      console.log("🔍 CHECK LOAD:", {
        time: item.time,
        loadActivePower: item.loadActivePower,
        loadApparentPower: item.loadApparentPower,
        pac: item.pac,
      });
    });

    const transformed = rawData.map((item) => ({
      time: item.time,

      // ===== PV =====
      pvPower: Number(item.ppv1 || item.ppv || 0),
      pvVoltage: Number(item.vpv || 0),
      pvCurrent: Number(item.ipv || 0),
      pvEnergy: Number(item.epvToday || 0),

      // ===== Battery =====
      batCharge: Number(item.echargeToday || 0),
      batDischarge: Number(item.edischargeToday || 0),

      // ===== Grid =====
      gridImport: Number(item.egridToday || 0),
      gridExport: Number(item.etoGridToday || 0),

      // ===== Load =====
      loadEnergy: Number(item.eloadToday || 0),

      // ⭐ Load P (kW) ที่ตรง Atess
      loadPower: calcLoadPower(item),

      // ===== Other =====
      outputFreq: Number(item.fac || 0),
    }));

    return res.json({ data: transformed });
  } catch (err) {
    log("❌ Failed to transform history:", err.message);
    return res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

module.exports = router;
