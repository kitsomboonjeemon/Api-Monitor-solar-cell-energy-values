const express = require("express");
const axios = require("axios");
const dayjs = require("dayjs");

const router = express.Router();

const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};

// ===================== CACHE =====================
let cacheData = [];
let lastRecordDate = null; // YYYY-MM-DD

// ===================== UTIL =====================
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getDeviceSn = (req) =>
  req.query.deviceSn || "YKD0F1022A";

// ===================== FETCH FROM ATESS =====================
async function fetchFromAtess(deviceSn, startDate, endDate) {
  const pageSize = 200;
  let pageNo = 1;
  const result = [];

  while (true) {
    const r = await axios.get(`${BASE_URL}/hps/data-list`, {
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

    const rows = r.data?.data?.datas || [];
    result.push(...rows);

    if (rows.length < pageSize) break;
    pageNo++;
  }

  return result;
}

// ===================== HISTORY API =====================
router.get("/hps/history", async (req, res) => {
  const deviceSn = getDeviceSn(req);

  try {
    // 🟢 ครั้งแรก → ดึงย้อนหลังทั้งหมด
    if (!lastRecordDate) {
      const startDate = "2024-06-01"; // 🔴 วันติดตั้งจริง
      const endDate = dayjs().format("YYYY-MM-DD");

      const rows = await fetchFromAtess(deviceSn, startDate, endDate);

      cacheData = rows
        .map((d) => ({
          time: dayjs(d.time).valueOf(),
          pvPower: toNumber(d.ppv),
          pvVoltage: toNumber(d.vpv),
          pvCurrent: toNumber(d.ipv),
        }))
        .filter((d) => d.time)
        .sort((a, b) => a.time - b.time);

      lastRecordDate = endDate;

      return res.json({ data: cacheData });
    }

    // 🟡 ทุกครั้งถัดมา → ดึงเฉพาะวันล่าสุด
    const today = dayjs().format("YYYY-MM-DD");

    if (today !== lastRecordDate) {
      const rows = await fetchFromAtess(
        deviceSn,
        lastRecordDate,
        today
      );

      const newData = rows
        .map((d) => ({
          time: dayjs(d.time).valueOf(),
          pvPower: toNumber(d.ppv),
          pvVoltage: toNumber(d.vpv),
          pvCurrent: toNumber(d.ipv),
        }))
        .filter((d) => d.time);

      if (newData.length > 0) {
        cacheData.push(...newData);
        cacheData.sort((a, b) => a.time - b.time);
      }

      lastRecordDate = today;
    }

    res.json({ data: cacheData });
  } catch (err) {
    console.error("❌ history error:", err.message);
    res.json({ data: cacheData });
  }
});

module.exports = router;
