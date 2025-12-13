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
let lastRecordTime = null;

// ===================== UTIL =====================
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getDeviceSn = (req) =>
  req.query.deviceSn || "YKD0F1022A";

// ===================== FETCH FROM ATESS =====================
async function fetchFromAtess(deviceSn, startTime, endTime) {
  const pageSize = 200;
  let pageNo = 1;
  const result = [];

  while (true) {
    const r = await axios.get(`${BASE_URL}/hps/data-list-small`, {
      params: {
        deviceSn,
        startTime,
        endTime,
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
    if (!lastRecordTime) {
      const startTime = "2024-06-01 00:00:00"; // 🔴 เปลี่ยนเป็นวันติดตั้งจริง
      const endTime = dayjs().format("YYYY-MM-DD HH:mm:ss");

      const rows = await fetchFromAtess(deviceSn, startTime, endTime);

      cacheData = rows
        .map((d) => ({
          time: dayjs(d.recordTime).valueOf(),
          pvPower: toNumber(d.ppv),
          pvVoltage: toNumber(d.vpv),
          pvCurrent: toNumber(d.ipv),
        }))
        .sort((a, b) => a.time - b.time);

      if (cacheData.length > 0) {
        lastRecordTime = dayjs(
          cacheData[cacheData.length - 1].time
        ).format("YYYY-MM-DD HH:mm:ss");
      }

      return res.json({ data: cacheData });
    }

    // 🟡 ทุก 6 นาที → ดึงเฉพาะข้อมูลใหม่
    const newRows = await fetchFromAtess(
      deviceSn,
      lastRecordTime,
      dayjs().format("YYYY-MM-DD HH:mm:ss")
    );

    const newData = newRows.map((d) => ({
      time: dayjs(d.recordTime).valueOf(),
      pvPower: toNumber(d.ppv),
      pvVoltage: toNumber(d.vpv),
      pvCurrent: toNumber(d.ipv),
    }));

    if (newData.length > 0) {
      cacheData.push(...newData);
      lastRecordTime = dayjs(
        newData[newData.length - 1].time
      ).format("YYYY-MM-DD HH:mm:ss");
    }

    res.json({ data: cacheData });
  } catch (err) {
    console.error("❌ history error:", err.message);
    res.json({ data: cacheData });
  }
});

module.exports = router;
